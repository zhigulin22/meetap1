import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { buildCompatibilityScore, buildFirstMessageSuggestions } from "@/server/ai";
import {
  isMissingCompatibilityTable,
  readCompatibilityCacheFromProfile,
  writeCompatibilityCacheToProfile,
} from "@/server/compatibility-cache";
import { buildCompatibilityReason, parseCompatibilityReason } from "@/server/compatibility-reason";
import { supabaseAdmin } from "@/supabase/admin";

const userIdParamSchema = z.string().uuid("Invalid target user");

type UserRow = {
  id: string;
  name: string;
  interests: string[] | null;
  hobbies: string[] | null;
  facts: string[] | null;
  university: string | null;
  work: string | null;
  personality_profile?: Record<string, unknown> | null;
};

function mergeInterests(user: UserRow) {
  const raw = [...(user.interests ?? []), ...(user.hobbies ?? [])];
  const uniq = new Set<string>();
  for (const item of raw) {
    const value = String(item).trim();
    if (value) uniq.add(value);
  }
  return [...uniq].slice(0, 8);
}

function buildProfileSummary(user: UserRow) {
  const bits: string[] = [];
  if (user.university) bits.push(`Университет: ${user.university}`);
  if (user.work) bits.push(`Работа: ${user.work}`);
  if ((user.facts ?? []).length) bits.push(`Факты: ${user.facts?.slice(0, 2).join("; ")}`);
  return bits.join(". ").slice(0, 500);
}

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    const requestUrl = new URL(_req.url);
    const refresh = requestUrl.searchParams.get("refresh") === "1";
    const parsedTarget = userIdParamSchema.safeParse(params.userId);
    if (!parsedTarget.success) {
      return fail("Invalid target user", 422);
    }

    const targetUserId = parsedTarget.data;
    if (targetUserId === userId) {
      return fail("Нельзя писать самому себе", 422);
    }

    const [meRes, targetRes, compatibilityRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,interests,hobbies,facts,university,work,personality_profile")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id,name,interests,hobbies,facts,university,work")
        .eq("id", targetUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_compatibility")
        .select("score,reason,source")
        .eq("user_id", userId)
        .eq("target_user_id", targetUserId)
        .maybeSingle(),
    ]);

    if (!meRes.data?.id || !targetRes.data?.id) {
      return fail("User not found", 404);
    }

    const me = meRes.data as UserRow;
    const target = targetRes.data as UserRow;
    const compatibilityData = compatibilityRes.data as
      | { score: number; reason: string | null; source: "ai" | "fallback" | null }
      | null;
    const cacheFromProfile = readCompatibilityCacheFromProfile(me.personality_profile)[targetUserId];
    const cachedPayload = isMissingCompatibilityTable(compatibilityRes.error?.message)
      ? parseCompatibilityReason(cacheFromProfile?.reason ?? null)
      : parseCompatibilityReason((compatibilityData?.reason as string | null) ?? null);
    if (!refresh && cachedPayload.firstMessages.length) {
      return ok({ items: cachedPayload.firstMessages });
    }

    const suggestions = await buildFirstMessageSuggestions({
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
    });

    const now = new Date().toISOString();
    const compatibility =
      compatibilityData ??
      (await buildCompatibilityScore({
        user1: {
          id: me.id,
          name: me.name,
          interests: mergeInterests(me),
          hobbies: me.hobbies ?? [],
          facts: me.facts ?? [],
          university: me.university,
          work: me.work,
        },
        user2: {
          id: target.id,
          name: target.name,
          interests: mergeInterests(target),
          hobbies: target.hobbies ?? [],
          facts: target.facts ?? [],
          university: target.university,
          work: target.work,
        },
        context: "Подбор людей для знакомства в личном чате",
      }));

    const existingReason = isMissingCompatibilityTable(compatibilityRes.error?.message)
      ? parseCompatibilityReason(cacheFromProfile?.reason ?? null)
      : parseCompatibilityReason(compatibilityData?.reason ?? null);
    const compatibilitySource =
      compatibilityData?.source === "ai" || compatibilityData?.source === "fallback"
        ? compatibilityData.source
        : compatibility.source === "ai"
          ? "ai"
          : "fallback";
    const reasonToStore = buildCompatibilityReason({
      reason: existingReason.reason || compatibility.reason || "Похоже по ритму и стилю общения",
      firstMessages: suggestions.messages,
      firstMessagesUpdatedAt: now,
      compatibilitySource,
      firstMessagesSource: suggestions.source === "ai" ? "ai" : "fallback",
    });

    const upsertResult = await supabaseAdmin.from("user_compatibility").upsert(
      {
        user_id: userId,
        target_user_id: targetUserId,
        score: compatibility.score,
        reason: reasonToStore,
        source: compatibilitySource,
        updated_at: now,
      },
      { onConflict: "user_id,target_user_id" },
    );
    if (upsertResult.error && isMissingCompatibilityTable(upsertResult.error.message)) {
      const nextProfile = writeCompatibilityCacheToProfile(me.personality_profile, {
        [targetUserId]: {
          score: compatibility.score,
          reason: reasonToStore,
          source: compatibilitySource,
          updated_at: now,
        },
      });
      await supabaseAdmin.from("users").update({ personality_profile: nextProfile }).eq("id", userId);
    }

    console.info("[first-message-suggestions]", {
      fromUserId: userId,
      targetUserId,
      items: suggestions.messages,
      refresh,
      source: suggestions.source,
    });

    return ok({ items: suggestions.messages });
  } catch {
    return fail("Unauthorized", 401);
  }
}
