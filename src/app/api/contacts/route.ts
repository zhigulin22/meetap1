import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { buildCompatibilityScore, buildFirstMessageSuggestions } from "@/server/ai";
import {
  type CompatibilityCacheEntry,
  isMissingCompatibilityTable,
  readCompatibilityCacheFromProfile,
  replaceCompatibilityCacheInProfile,
  writeCompatibilityCacheToProfile,
} from "@/server/compatibility-cache";
import { buildCompatibilityReason, parseCompatibilityReason } from "@/server/compatibility-reason";

type ContactUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  interests: string[] | null;
  hobbies: string[] | null;
  facts: string[] | null;
  level: number | null;
  university: string | null;
  work: string | null;
  personality_profile: Record<string, unknown> | null;
};
type ContactGroup = { id: string; title: string; city: string; event_date: string };
type CompatibilityRow = {
  target_user_id: string;
  score: number;
  reason: string | null;
  source: "ai" | "fallback" | null;
  updated_at: string;
};

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((v) => String(v).trim()).filter(Boolean);
}

function pickRandom<T>(items: T[], count: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function profileForAi(user: ContactUser) {
  const personality =
    user.personality_profile && typeof user.personality_profile === "object"
      ? { ...user.personality_profile }
      : undefined;
  if (personality && "compatibility_cache_v1" in personality) {
    delete personality.compatibility_cache_v1;
  }

  return {
    id: user.id,
    name: user.name,
    interests: normalizeList(user.interests),
    hobbies: normalizeList(user.hobbies),
    facts: normalizeList(user.facts),
    university: user.university,
    work: user.work,
    level: user.level ?? 1,
    personality_profile: personality,
  };
}

function includesQuery(user: ContactUser, q: string) {
  if (!q) return true;
  const blob = [
    user.name,
    ...(user.interests ?? []),
    ...(user.hobbies ?? []),
    ...(user.facts ?? []),
    user.university ?? "",
    user.work ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}

function fallbackReason(common: string[]) {
  return common.length > 0 ? `Совпадения: ${common.slice(0, 3).join(", ")}` : "Похоже по ритму и стилю общения";
}

function mergeInterests(user: ContactUser) {
  const raw = [...normalizeList(user.interests), ...normalizeList(user.hobbies)];
  return [...new Set(raw)].slice(0, 10);
}

function buildProfileSummary(user: ContactUser) {
  const bits: string[] = [];
  if (user.university) bits.push(`Университет: ${user.university}`);
  if (user.work) bits.push(`Работа: ${user.work}`);
  if ((user.facts ?? []).length) bits.push(`Факты: ${(user.facts ?? []).slice(0, 2).join("; ")}`);
  if (user.personality_profile && typeof user.personality_profile === "object") {
    const personality = JSON.stringify(user.personality_profile).slice(0, 500);
    if (personality) bits.push(`Профиль: ${personality}`);
  }
  return bits.join(". ").slice(0, 900);
}

async function seedCompatibility(args: {
  userId: string;
  me: ContactUser;
  allCandidates: ContactUser[];
  existingRows: CompatibilityRow[];
  seedCount: number;
  forceReplace?: boolean;
}) {
  const { userId, me, allCandidates, existingRows, seedCount, forceReplace = false } = args;
  const targetCount = Math.min(seedCount, allCandidates.length);
  if (targetCount < 1) return;

  const existingTargets = new Set(existingRows.map((x) => x.target_user_id));
  const selected = forceReplace
    ? pickRandom(allCandidates, targetCount)
    : pickRandom(
        allCandidates.filter((u) => !existingTargets.has(u.id)),
        Math.max(0, targetCount - existingTargets.size),
      );
  if (!selected.length) return;

  const now = new Date().toISOString();
  const rows = await Promise.all(
    selected.map(async (target) => {
      const [compat, firstMessages] = await Promise.all([
        buildCompatibilityScore({
          user1: profileForAi(me),
          user2: profileForAi(target),
          context: "Подбор людей для знакомств в приложении",
        }),
        buildFirstMessageSuggestions({
          user1: {
            name: me.name,
            interests: mergeInterests(me),
            profileSummary: buildProfileSummary(me),
          },
          user2: {
            name: target.name,
            interests: mergeInterests(target),
            profileSummary: buildProfileSummary(target),
          },
          context: "Первое сообщение в личном чате Meetap.",
        }),
      ]);

      const reason = buildCompatibilityReason({
        reason: compat.reason,
        firstMessages: firstMessages.messages,
        firstMessagesUpdatedAt: now,
        compatibilitySource: compat.source === "ai" ? "ai" : "fallback",
        firstMessagesSource: firstMessages.source === "ai" ? "ai" : "fallback",
      });

      return {
        user_id: userId,
        target_user_id: target.id,
        score: compat.score,
        reason,
        source: compat.source === "ai" ? "ai" : "fallback",
        updated_at: now,
      };
    }),
  );

  const cacheEntries: Record<string, CompatibilityCacheEntry> = Object.fromEntries(
    rows.map((row) => [
      row.target_user_id,
      {
        score: row.score,
        reason: row.reason,
        source: row.source === "ai" ? "ai" : "fallback",
        updated_at: row.updated_at,
      },
    ]),
  );

  if (forceReplace) {
    const deleteResult = await supabaseAdmin.from("user_compatibility").delete().eq("user_id", userId);
    if (!deleteResult.error) {
      const upsertResult = await supabaseAdmin.from("user_compatibility").upsert(rows, {
        onConflict: "user_id,target_user_id",
      });
      if (!upsertResult.error) return;
      if (!isMissingCompatibilityTable(upsertResult.error.message)) return;
    } else if (!isMissingCompatibilityTable(deleteResult.error.message)) {
      return;
    }

    const nextProfile = replaceCompatibilityCacheInProfile(me.personality_profile, cacheEntries);
    await supabaseAdmin.from("users").update({ personality_profile: nextProfile }).eq("id", userId);
    return;
  }

  const upsertResult = await supabaseAdmin.from("user_compatibility").upsert(rows, {
    onConflict: "user_id,target_user_id",
  });
  if (!upsertResult.error) return;
  if (!isMissingCompatibilityTable(upsertResult.error.message)) return;

  const nextProfile = writeCompatibilityCacheToProfile(me.personality_profile, cacheEntries);
  await supabaseAdmin.from("users").update({ personality_profile: nextProfile }).eq("id", userId);
}

export async function GET(req: NextRequest) {
  try {
    const env = getServerEnv();
    const userId = requireUserId();
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const seedCount = env.COMPATIBILITY_SEED_COUNT;

    const [{ data: meRaw }, { data: usersRaw }, { data: eventsRaw }, compatibilityQuery] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,avatar_url,interests,hobbies,facts,level,university,work,personality_profile")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("users")
        .select("id,name,avatar_url,interests,hobbies,facts,level,university,work,personality_profile")
        .neq("id", userId)
        .limit(300),
      supabaseAdmin.from("events").select("id,title,city,event_date").limit(20),
      supabaseAdmin
        .from("user_compatibility")
        .select("target_user_id,score,reason,source,updated_at")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

    if (!meRaw) {
      return fail("User not found", 404);
    }

    const me = meRaw as ContactUser;
    const myInterests = normalizeList(me.interests);
    const myInterestSet = new Set(myInterests);

    const users = (usersRaw ?? []) as ContactUser[];
    const events = (eventsRaw ?? []) as ContactGroup[];
    const compatibilityRaw = compatibilityQuery.data as CompatibilityRow[] | null;
    const compatibilityError = compatibilityQuery.error;
    const initialRows = isMissingCompatibilityTable(compatibilityError?.message)
      ? Object.entries(readCompatibilityCacheFromProfile(me.personality_profile)).map(
          ([target_user_id, entry]) => ({
            target_user_id,
            score: entry.score,
            reason: entry.reason,
            source: entry.source,
            updated_at: entry.updated_at,
          }),
        )
      : ((compatibilityRaw ?? []) as CompatibilityRow[]);
    const userIdSet = new Set(users.map((u) => u.id));
    const existingRows = initialRows.filter((x) => userIdSet.has(x.target_user_id));

    await seedCompatibility({
      userId,
      me,
      allCandidates: users,
      existingRows,
      seedCount,
      forceReplace: refresh,
    });

    const rowsQuery = await supabaseAdmin
      .from("user_compatibility")
      .select("target_user_id,score,reason,source,updated_at")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    const rowsRaw = rowsQuery.data as CompatibilityRow[] | null;
    const rowsError = rowsQuery.error;
    const rowsFromProfile = isMissingCompatibilityTable(rowsError?.message)
      ? Object.entries(
          readCompatibilityCacheFromProfile(
            (
              await supabaseAdmin
                .from("users")
                .select("personality_profile")
                .eq("id", userId)
                .single()
            ).data?.personality_profile,
          ),
        ).map(([target_user_id, entry]) => ({
          target_user_id,
          score: entry.score,
          reason: entry.reason,
          source: entry.source,
          updated_at: entry.updated_at,
        }))
      : [];

    const sourceRows = (rowsRaw as CompatibilityRow[] | null) ?? (rowsFromProfile.length ? rowsFromProfile : existingRows);
    const rows = sourceRows
      .filter((x) => userIdSet.has(x.target_user_id))
      .sort((a, b) => {
        const scoreDiff = Number(b.score) - Number(a.score);
        if (scoreDiff !== 0) return scoreDiff;
        return +new Date(b.updated_at) - +new Date(a.updated_at);
      });

    const usersMap = new Map(users.map((u) => [u.id, u]));
    const people = rows
      .map((row) => {
        const user = usersMap.get(row.target_user_id);
        if (!user || !includesQuery(user, q)) return null;

        const interests = normalizeList(user.interests);
        const common = interests.filter((x) => myInterestSet.has(x));
        const reasonPayload = parseCompatibilityReason(row.reason);
        return {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          interests: user.interests,
          compatibility: Math.max(0, Math.min(100, Number(row.score))),
          common,
          reason: reasonPayload.reason || fallbackReason(common),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.compatibility - a.compatibility);

    const peopleWithFallback = people.length
      ? people
      : users
          .filter((u) => includesQuery(u, q))
          .map((u) => {
            const interests = normalizeList(u.interests);
            const common = interests.filter((x) => myInterestSet.has(x));
            return {
              id: u.id,
              name: u.name,
              avatar_url: u.avatar_url,
              interests: u.interests,
              compatibility: Math.min(95, 30 + common.length * 18 + (u.level ?? 1) * 2),
              common,
              reason: fallbackReason(common),
            };
          })
          .sort((a, b) => b.compatibility - a.compatibility);

    const groups = events.filter((e: ContactGroup) =>
      q ? e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) : true,
    );

    const hotMatches = peopleWithFallback.slice(0, Math.max(1, seedCount));

    return ok({ people: peopleWithFallback, groups, hotMatches });
  } catch {
    return fail("Unauthorized", 401);
  }
}
