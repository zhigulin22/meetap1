#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

function normalizeList(value, limit = 12, maxLen = 120) {
  if (!Array.isArray(value)) return [];
  const uniq = new Set();
  for (const item of value) {
    const text = String(item ?? "").trim().slice(0, maxLen);
    if (text) uniq.add(text);
  }
  return [...uniq].slice(0, limit);
}

function mergeInterests(user) {
  return [...new Set([...normalizeList(user.interests, 12, 80), ...normalizeList(user.hobbies, 12, 80)])].slice(
    0,
    10,
  );
}

function buildProfileSummary(user) {
  const bits = [];
  if (user.university) bits.push(`Университет: ${String(user.university).slice(0, 120)}`);
  if (user.work) bits.push(`Работа: ${String(user.work).slice(0, 120)}`);
  const facts = normalizeList(user.facts, 2, 180);
  if (facts.length) bits.push(`Факты: ${facts.join("; ")}`);
  return bits.join(". ").slice(0, 900);
}

function profileForAi(user) {
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
    interests: normalizeList(user.interests, 12, 80),
    hobbies: normalizeList(user.hobbies, 12, 80),
    facts: normalizeList(user.facts, 8, 140),
    university: user.university ?? null,
    work: user.work ?? null,
    level: Number.isFinite(Number(user.level)) ? Number(user.level) : 1,
    personality_profile: personality,
  };
}

function fallbackCompatibility(user1, user2) {
  const interests1 = new Set(normalizeList(user1.interests, 12, 80));
  const interests2 = new Set(normalizeList(user2.interests, 12, 80));
  const hobbies1 = new Set(normalizeList(user1.hobbies, 12, 80));
  const hobbies2 = new Set(normalizeList(user2.hobbies, 12, 80));
  const sharedInterests = [...interests1].filter((x) => interests2.has(x));
  const sharedHobbies = [...hobbies1].filter((x) => hobbies2.has(x));
  const sameUniversity = Boolean(user1.university) && user1.university === user2.university;

  let score = 22;
  score += Math.min(4, sharedInterests.length) * 14;
  score += Math.min(3, sharedHobbies.length) * 9;
  if (sameUniversity) score += 9;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const reason =
    sharedInterests.length > 0
      ? `Сильное совпадение по интересам: ${sharedInterests.slice(0, 3).join(", ")}`
      : sharedHobbies.length > 0
        ? `Близкие хобби: ${sharedHobbies.slice(0, 2).join(", ")}`
        : sameUniversity
          ? "Есть общий контекст: один университет"
          : "Потенциально комфортный диалог при мягком старте";

  return { score, reason: reason.slice(0, 240), source: "fallback" };
}

function fallbackFirstMessages(user1, user2) {
  const myTopic = mergeInterests(user1)[0] ?? "новые знакомства";
  const baseTopic = mergeInterests(user2)[0] ?? "знакомство";
  return {
    source: "fallback",
    items: [
      "Привет! Пишу познакомиться. Как проходит твой день?",
      `Привет! Мне близка тема ${myTopic}, поэтому решил написать. Если комфортно, давай познакомимся.`,
      `Привет! Вижу, тебе близка тема ${baseTopic}. Что тебе в ней сейчас больше всего нравится?`,
    ],
  };
}

async function postJson(url, payload, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(label, fn, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        const waitMs = 300 * i;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
}

async function buildPairData(aiBaseUrl, user1, user2) {
  const fallbackCompat = fallbackCompatibility(user1, user2);
  const fallbackFirst = fallbackFirstMessages(user1, user2);

  const [compatibility, firstMessages] = await Promise.all([
    (async () => {
      try {
        const raw = await postJson(`${aiBaseUrl}/v1/compatibility-score`, {
          user1: profileForAi(user1),
          user2: profileForAi(user2),
          context: "Подбор людей для знакомств в приложении",
        });
        const score = Number(raw?.score);
        return {
          score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallbackCompat.score,
          reason: String(raw?.reason ?? fallbackCompat.reason).trim().slice(0, 240) || fallbackCompat.reason,
          source: "ai",
        };
      } catch {
        return fallbackCompat;
      }
    })(),
    (async () => {
      try {
        const raw = await postJson(`${aiBaseUrl}/v1/first-message-suggestions`, {
          user1: {
            name: user1.name,
            interests: mergeInterests(user1),
            profileSummary: buildProfileSummary(user1),
          },
          user2: {
            name: user2.name,
            interests: mergeInterests(user2),
            profileSummary: buildProfileSummary(user2),
          },
          context: "Первое сообщение в личном чате Meetap.",
        });
        const items = Array.isArray(raw?.messages)
          ? [...new Set(raw.messages.map((x) => String(x).trim()).filter(Boolean))].slice(0, 3)
          : [];
        if (!items.length) return fallbackFirst;
        return { source: "ai", items };
      } catch {
        return fallbackFirst;
      }
    })(),
  ]);

  return {
    score: compatibility.score,
    source: compatibility.source,
    reason: JSON.stringify({
      v: 1,
      reason: compatibility.reason,
      compatibility_source: compatibility.source,
      first_messages: firstMessages.items,
      first_messages_source: firstMessages.source,
      first_messages_updated_at: new Date().toISOString(),
    }),
  };
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function isMissingCompatibilityTable(errorMessage) {
  const text = String(errorMessage ?? "").toLowerCase();
  return text.includes("user_compatibility") && text.includes("schema cache");
}

function readCompatibilityCacheFromProfile(profile) {
  const base = profile && typeof profile === "object" && !Array.isArray(profile) ? { ...profile } : {};
  const raw = base.compatibility_cache_v1;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const [targetUserId, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value;
    const score = Number(row.score);
    const reason = String(row.reason ?? "").trim();
    if (!reason) continue;
    result[targetUserId] = {
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      reason: reason.slice(0, 3500),
      source: row.source === "ai" ? "ai" : "fallback",
      updated_at: String(row.updated_at ?? "").trim() || new Date().toISOString(),
    };
  }
  return result;
}

function writeCompatibilityCacheToProfile(profile, entries) {
  const base = profile && typeof profile === "object" && !Array.isArray(profile) ? { ...profile } : {};
  const merged = { ...readCompatibilityCacheFromProfile(base), ...entries };
  base.compatibility_cache_v1 = merged;
  return base;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const aiServiceUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const seedCountRaw = Number(process.env.COMPATIBILITY_SEED_COUNT ?? "10");
  const seedCount = Number.isFinite(seedCountRaw) ? Math.max(1, Math.min(50, Math.floor(seedCountRaw))) : 10;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: usersRaw, error: usersError } = await supabase
    .from("users")
    .select("id,name,interests,hobbies,facts,university,work,level,personality_profile")
    .limit(5000);

  if (usersError) throw new Error(usersError.message);
  const allUsers = usersRaw ?? [];
  let users = allUsers;
  const onlyUserIds = String(process.env.BACKFILL_USER_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (onlyUserIds.length) {
    const onlySet = new Set(onlyUserIds);
    users = users.filter((u) => onlySet.has(u.id));
  }
  if (allUsers.length < 2) {
    console.log("Недостаточно пользователей для расчета совместимости");
    return;
  }
  if (users.length < 1) {
    console.log("Не найдено пользователей для точечного backfill");
    return;
  }

  let totalPairs = 0;
  let failedUsers = 0;

  for (let i = 0; i < users.length; i += 1) {
    const me = users[i];
    const candidates = allUsers.filter((u) => u.id !== me.id);
    const selected = pickRandom(candidates, Math.min(seedCount, candidates.length));
    if (!selected.length) continue;

    const now = new Date().toISOString();
    const rows = [];
    for (const target of selected) {
      const pairData = await buildPairData(aiServiceUrl, me, target);
      rows.push({
        user_id: me.id,
        target_user_id: target.id,
        score: pairData.score,
        reason: pairData.reason,
        source: pairData.source,
        updated_at: now,
      });
    }

    try {
      const deleteRes = await withRetry(`delete failed for user ${me.id}`, () =>
        supabase.from("user_compatibility").delete().eq("user_id", me.id),
      );
      const deleteError = deleteRes.error;
      if (deleteError && !isMissingCompatibilityTable(deleteError.message)) {
        throw new Error(deleteError.message);
      }

      if (!deleteError) {
        const upsertRes = await withRetry(`upsert failed for user ${me.id}`, () =>
          supabase.from("user_compatibility").upsert(rows, { onConflict: "user_id,target_user_id" }),
        );
        const upsertError = upsertRes.error;
        if (upsertError && !isMissingCompatibilityTable(upsertError.message)) {
          throw new Error(upsertError.message);
        }

        if (upsertError && isMissingCompatibilityTable(upsertError.message)) {
          const entries = Object.fromEntries(
            rows.map((row) => [
              row.target_user_id,
              {
                score: row.score,
                reason: row.reason,
                source: row.source,
                updated_at: row.updated_at,
              },
            ]),
          );
          const nextProfile = writeCompatibilityCacheToProfile(me.personality_profile, entries);
          const profileRes = await withRetry(`profile fallback failed for user ${me.id}`, () =>
            supabase.from("users").update({ personality_profile: nextProfile }).eq("id", me.id),
          );
          if (profileRes.error) {
            throw new Error(profileRes.error.message);
          }
        }
      } else {
        const entries = Object.fromEntries(
          rows.map((row) => [
            row.target_user_id,
            {
              score: row.score,
              reason: row.reason,
              source: row.source,
              updated_at: row.updated_at,
            },
          ]),
        );
        const nextProfile = writeCompatibilityCacheToProfile(me.personality_profile, entries);
        const profileRes = await withRetry(`profile fallback failed for user ${me.id}`, () =>
          supabase.from("users").update({ personality_profile: nextProfile }).eq("id", me.id),
        );
        if (profileRes.error) {
          throw new Error(profileRes.error.message);
        }
      }
    } catch (error) {
      failedUsers += 1;
      console.error(`[${i + 1}/${users.length}] ошибка для пользователя ${me.id}: ${error?.message ?? error}`);
      continue;
    }

    totalPairs += rows.length;
    console.log(`[${i + 1}/${users.length}] сохранено пар для пользователя ${me.id}: ${rows.length}`);
  }

  console.log(`Готово: пересчитано и сохранено пар: ${totalPairs}, пользователей с ошибками: ${failedUsers}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err?.message ?? err);
  process.exit(1);
});
