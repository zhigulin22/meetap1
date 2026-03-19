import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { canonicalizeEventName, isActivityEventName } from "@/server/event-dictionary";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

type EventRow = {
  event_name: string;
  user_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type UserRow = {
  id: string;
  city?: string | null;
  role?: string | null;
  profile_completed?: boolean | null;
  shadow_banned?: boolean | null;
  message_limited?: boolean | null;
  is_demo?: boolean | null;
  demo_group?: string | null;
  personality_profile?: Record<string, unknown> | null;
  interests?: unknown;
  facts?: unknown;
  avatar_url?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  telegram_verified?: boolean | null;
};

const schema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
});

const C = {
  register_started: new Set(["register_started"]),
  telegram_verified: new Set(["telegram_verified"]),
  registration_completed: new Set(["registration_completed"]),
  profile_completed: new Set(["profile_completed"]),
  post: new Set(["post_published_daily_duo", "post_published_video"]),
  post_duo: new Set(["post_published_daily_duo"]),
  post_video: new Set(["post_published_video"]),
  event_viewed: new Set(["event_viewed"]),
  event_joined: new Set(["event_joined"]),
  connect_sent: new Set(["connect_sent"]),
  connect_replied: new Set(["connect_replied"]),
  message_sent: new Set(["message_sent"]),
  report_created: new Set(["report_created"]),
  ai_cost: new Set(["ai_cost"]),
  ai_request: new Set(["ai_request"]),
  ai_error: new Set(["ai_error"]),
};

const SUMMARY_CACHE_TTL_MS = 10_000;
const SUMMARY_CACHE_MAX_STALE_MS = 2 * 60_000;
const EVENTS_FAST_LIMIT = 50_000;
const USERS_SNAPSHOT_LIMIT = 15_000;
const RISK_FAST_LIMIT = 10_000;
type SummaryCacheEntry = { cachedAt: number; expiresAt: number; payload: any };
const summaryCache = new Map<string, SummaryCacheEntry>();

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function inDays(iso: string, nowTs: number, days: number) {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts >= nowTs - days * 24 * 60 * 60 * 1000;
}

function arrLen(value: unknown) {
  if (Array.isArray(value)) return value.length;
  return 0;
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Number((n / d).toFixed(4));
}

function topEntries(map: Map<string, number>, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      days: searchParams.get("days") ?? 30,
      segment: searchParams.get("segment") ?? "all",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const cacheKey = `${parsed.data.days}:${parsed.data.segment}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ok({
        ...cached.payload,
        cache: { mode: "hot", cached_at: new Date(cached.cachedAt).toISOString() },
      });
    }

    const now = Date.now();
    const toISO = new Date(now).toISOString();
    const fromISO = new Date(now - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
    const { fromISO: safeFromISO, toISO: safeToISO } = parseWindow(fromISO, toISO, parsed.data.days);

    const [schemaSnapshot, segmentUserIds] = await Promise.all([
      getSchemaSnapshot(["users", "analytics_events", "risk_signals"]),
      getSegmentUserIds(parsed.data.segment, safeFromISO, safeToISO),
    ]);

    const usersCols = asSet(schemaSnapshot, "users");
    const analyticsCols = asSet(schemaSnapshot, "analytics_events");
    const riskCols = asSet(schemaSnapshot, "risk_signals");

    const warnings: string[] = [];

    if (!usersCols.has("id")) warnings.push("users.id отсутствует");
    if (!analyticsCols.has("event_name") || !analyticsCols.has("created_at")) {
      warnings.push("analytics_events имеет неполную схему");
    }

    let eventsQuery = supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id,properties,created_at")
      .gte("created_at", safeFromISO)
      .lte("created_at", safeToISO)
      .order("created_at", { ascending: true })
      .limit(EVENTS_FAST_LIMIT);

    if (segmentUserIds && segmentUserIds.length) eventsQuery = eventsQuery.in("user_id", segmentUserIds);

    const eventsRes = await eventsQuery;
    if (eventsRes.error) return fail(eventsRes.error.message, 500);

    const eventRows = (eventsRes.data ?? []) as EventRow[];
    if (eventRows.length >= EVENTS_FAST_LIMIT) warnings.push("analytics_events snapshot truncated (fast mode)");
    const activityRows = eventRows.filter((r) => isActivityEventName(r.event_name));

    const usersMap = new Map<string, UserRow>();
    const userIdsFromEvents = [...new Set(activityRows.map((r) => r.user_id).filter(Boolean) as string[])];

    if (usersCols.has("id") && userIdsFromEvents.length) {
      const selectCols = [
        "id",
        "city",
        "role",
        "profile_completed",
        "shadow_banned",
        "message_limited",
        "is_demo",
        "demo_group",
        "personality_profile",
        "interests",
        "facts",
        "avatar_url",
        "created_at",
        "deleted_at",
        "telegram_verified",
      ].filter((c) => usersCols.has(c));
      if (!selectCols.includes("id")) selectCols.unshift("id");

      const usersRes = await supabaseAdmin
        .from("users")
        .select(selectCols.join(","))
        .in("id", userIdsFromEvents.slice(0, 5000));

      if (!usersRes.error) {
        for (const row of (usersRes.data ?? []) as UserRow[]) usersMap.set(row.id, row);
      }
    }

    const usersSnapshotCols = [
      "id",
      "city",
      "role",
      "profile_completed",
      "shadow_banned",
      "message_limited",
      "is_demo",
      "demo_group",
      "personality_profile",
      "interests",
      "facts",
      "avatar_url",
      "created_at",
      "deleted_at",
      "telegram_verified",
    ].filter((c) => usersCols.has(c));

    let usersSnapshot: UserRow[] = [];
    if (usersCols.has("id")) {
      if (!usersSnapshotCols.includes("id")) usersSnapshotCols.unshift("id");
      let usersSnapshotQuery = supabaseAdmin
        .from("users")
        .select(usersSnapshotCols.join(","))
        .limit(USERS_SNAPSHOT_LIMIT);
      if (usersCols.has("created_at")) usersSnapshotQuery = usersSnapshotQuery.order("created_at", { ascending: false });
      const usersSnapshotRes = await usersSnapshotQuery;

      if (usersSnapshotRes.error) {
        warnings.push(`users snapshot error: ${usersSnapshotRes.error.message}`);
      } else {
        usersSnapshot = (usersSnapshotRes.data ?? []) as UserRow[];
      }
    }

    if (usersSnapshot.length >= USERS_SNAPSHOT_LIMIT) {
      warnings.push("users snapshot truncated (fast mode)");
    }

    for (const row of usersSnapshot) {
      if (row.id && !usersMap.has(row.id)) usersMap.set(row.id, row);
    }

    const cut24h = now - 24 * 60 * 60 * 1000;
    const cut7d = now - 7 * 24 * 60 * 60 * 1000;
    const cut30d = now - 30 * 24 * 60 * 60 * 1000;

    let usersTotal = 0;
    let usersNew24h = 0;
    let usersNew7d = 0;
    let usersNew30d = 0;
    let deletedUsers30d = 0;
    let demoUsersTotal = 0;
    let profileCompletedCount = 0;
    let avatarCount = 0;
    let psychCount = 0;
    let shadowBannedCount = 0;
    let messageLimitedCount = 0;

    const rolesCountMap = new Map<string, number>();
    let interestsSum = 0;
    let interestsN = 0;
    let factsFilledUsers = 0;

    for (const row of usersSnapshot) {
      usersTotal += 1;

      if (row.created_at) {
        const createdTs = new Date(row.created_at).getTime();
        if (Number.isFinite(createdTs)) {
          if (createdTs >= cut24h) usersNew24h += 1;
          if (createdTs >= cut7d) usersNew7d += 1;
          if (createdTs >= cut30d) usersNew30d += 1;
        }
      }

      if (row.deleted_at) {
        const deletedTs = new Date(row.deleted_at).getTime();
        if (Number.isFinite(deletedTs) && deletedTs >= cut30d) deletedUsers30d += 1;
      }

      if (row.is_demo) demoUsersTotal += 1;
      if (row.profile_completed) profileCompletedCount += 1;
      if (row.avatar_url) avatarCount += 1;
      if (row.personality_profile) psychCount += 1;
      if (row.shadow_banned) shadowBannedCount += 1;
      if (row.message_limited) messageLimitedCount += 1;

      const role = String(row.role ?? "user");
      rolesCountMap.set(role, (rolesCountMap.get(role) ?? 0) + 1);

      if (usersCols.has("interests")) {
        interestsSum += arrLen(row.interests);
        interestsN += 1;
      }
      if (usersCols.has("facts") && arrLen(row.facts) >= 2) factsFilledUsers += 1;
    }

    const avgInterestsCount = interestsN ? Number((interestsSum / interestsN).toFixed(3)) : 0;

    const canonicalRows = activityRows.map((row) => ({
      ...row,
      canonical: canonicalizeEventName(row.event_name),
    }));

    const rows24 = canonicalRows.filter((r) => inDays(r.created_at, now, 1));
    const rows7 = canonicalRows.filter((r) => inDays(r.created_at, now, 7));
    const rows30 = canonicalRows.filter((r) => inDays(r.created_at, now, 30));

    const countBy = (rows: Array<{ canonical: string }>, set: Set<string>) => rows.reduce((acc, r) => acc + (set.has(r.canonical) ? 1 : 0), 0);
    const distinctUsers = (rows: Array<{ user_id: string | null }>) => new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]).size;

    const topEvents24hMap = new Map<string, number>();
    for (const row of rows24) {
      topEvents24hMap.set(row.canonical, (topEvents24hMap.get(row.canonical) ?? 0) + 1);
    }

    const userStats = new Map<string, { events: number; connect_sent: number; connect_replied: number; posts: number; joins: number; reports_received: number }>();
    const reportsReceived = new Map<string, number>();
    const userCityFromEvents = new Map<string, string>();

    for (const row of rows30) {
      if (!row.user_id) continue;
      const key = row.user_id;
      const stat = userStats.get(key) ?? { events: 0, connect_sent: 0, connect_replied: 0, posts: 0, joins: 0, reports_received: 0 };
      const cityFromEvent = String((row.properties?.city as string | undefined) ?? "").trim();
      if (cityFromEvent && !userCityFromEvents.has(key)) userCityFromEvents.set(key, cityFromEvent);
      stat.events += 1;
      if (C.connect_sent.has(row.canonical)) stat.connect_sent += 1;
      if (C.connect_replied.has(row.canonical)) stat.connect_replied += 1;
      if (C.post.has(row.canonical)) stat.posts += 1;
      if (C.event_joined.has(row.canonical)) stat.joins += 1;
      userStats.set(key, stat);

      if (C.report_created.has(row.canonical)) {
        const target = String((row.properties?.target_user_id as string | undefined) ?? "").trim();
        if (target) reportsReceived.set(target, (reportsReceived.get(target) ?? 0) + 1);
      }
    }

    for (const [uid, c] of reportsReceived.entries()) {
      const stat = userStats.get(uid) ?? { events: 0, connect_sent: 0, connect_replied: 0, posts: 0, joins: 0, reports_received: 0 };
      stat.reports_received = c;
      userStats.set(uid, stat);
    }

    const topUsers30d = [...userStats.entries()]
      .map(([user_id, s]) => {
        const u = usersMap.get(user_id);
        return {
          user_id,
          events: s.events,
          connect_sent: s.connect_sent,
          connect_replied: s.connect_replied,
          posts: s.posts,
          joins: s.joins,
          city: (u?.city as string | undefined) ?? userCityFromEvents.get(user_id) ?? "—",
        };
      })
      .sort((a, b) => b.events - a.events)
      .slice(0, 20);

    const cityAgg = new Map<string, { users: Set<string>; events: number; joins: number }>();
    for (const [uid, stat] of userStats.entries()) {
      const city = (usersMap.get(uid)?.city as string | undefined) ?? userCityFromEvents.get(uid) ?? "—";
      const bucket = cityAgg.get(city) ?? { users: new Set<string>(), events: 0, joins: 0 };
      bucket.users.add(uid);
      bucket.events += stat.events;
      bucket.joins += stat.joins;
      cityAgg.set(city, bucket);
    }

    const cities30d = [...cityAgg.entries()]
      .map(([city, b]) => ({ city, users: b.users.size, events: b.events, joins: b.joins }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 20);

    let riskTop: Array<{ user_id: string; risk_score: number; signals: string[] }> = [];
    if (riskCols.has("user_id") && riskCols.has("signal_key") && riskCols.has("severity")) {
      const riskRes = await supabaseAdmin
        .from("risk_signals")
        .select("user_id,signal_key,severity,created_at")
        .gte("created_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(RISK_FAST_LIMIT);

      if (!riskRes.error) {
        const byUser = new Map<string, { score: number; signals: Set<string> }>();
        for (const row of riskRes.data ?? []) {
          const uid = String((row as any).user_id ?? "");
          if (!uid) continue;
          const sev = Number((row as any).severity ?? 1);
          const signal = String((row as any).signal_key ?? "unknown");
          const b = byUser.get(uid) ?? { score: 0, signals: new Set<string>() };
          b.score += Number.isFinite(sev) ? sev : 1;
          b.signals.add(signal);
          byUser.set(uid, b);
        }
        riskTop = [...byUser.entries()]
          .map(([user_id, b]) => ({ user_id, risk_score: Math.min(100, b.score), signals: [...b.signals].slice(0, 5) }))
          .sort((a, b) => b.risk_score - a.risk_score)
          .slice(0, 20);
      }
    }

    if (!riskTop.length) {
      riskTop = [...userStats.entries()]
        .map(([user_id, s]) => {
          const signals: string[] = [];
          let score = 0;
          const replyRate = s.connect_sent > 0 ? s.connect_replied / s.connect_sent : 0;
          if (s.connect_sent > 120) {
            signals.push("high_connect_sent");
            score += 45;
          }
          if (s.connect_sent > 40 && replyRate < 0.05) {
            signals.push("low_reply_rate");
            score += 25;
          }
          if ((reportsReceived.get(user_id) ?? 0) >= 3) {
            signals.push("reports_received_spike");
            score += 35;
          }
          const u = usersMap.get(user_id);
          if (u?.shadow_banned) {
            signals.push("shadow_banned");
            score += 20;
          }
          if (u?.message_limited) {
            signals.push("message_limited");
            score += 15;
          }
          return { user_id, risk_score: Math.min(100, score), signals };
        })
        .filter((x) => x.risk_score > 0)
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 20);
    }

    const breakdownByDayMap = new Map<string, { events: number; users: Set<string>; posts: number; joins: number; connect_sent: number; connect_replied: number; reports: number }>();
    for (const row of canonicalRows) {
      const d = dayKey(row.created_at);
      const bucket = breakdownByDayMap.get(d) ?? { events: 0, users: new Set<string>(), posts: 0, joins: 0, connect_sent: 0, connect_replied: 0, reports: 0 };
      bucket.events += 1;
      if (row.user_id) bucket.users.add(row.user_id);
      if (C.post.has(row.canonical)) bucket.posts += 1;
      if (C.event_joined.has(row.canonical)) bucket.joins += 1;
      if (C.connect_sent.has(row.canonical)) bucket.connect_sent += 1;
      if (C.connect_replied.has(row.canonical)) bucket.connect_replied += 1;
      if (C.report_created.has(row.canonical)) bucket.reports += 1;
      breakdownByDayMap.set(d, bucket);
    }

    const breakdownByDay = [...breakdownByDayMap.entries()]
      .map(([day, b]) => ({
        day,
        events: b.events,
        active_users: b.users.size,
        posts: b.posts,
        joins: b.joins,
        connect_sent: b.connect_sent,
        connect_replied: b.connect_replied,
        reports: b.reports,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const startSet = new Set(rows30.filter((r) => C.register_started.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);
    const verifiedSet = new Set(rows30.filter((r) => C.telegram_verified.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);
    const completedSet = new Set(rows30.filter((r) => C.registration_completed.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);
    const profileSet = new Set(rows30.filter((r) => C.profile_completed.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);
    const activatedSet = new Set(rows30.filter((r) => C.post.has(r.canonical) || C.event_joined.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);
    const repliedSet = new Set(rows30.filter((r) => C.connect_replied.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]);

    const funnelStartCount = startSet.size > 0 ? startSet.size : verifiedSet.size;
    const funnelSteps = [
      { step: startSet.size > 0 ? "auth.register_started" : "auth.telegram_verified (proxy)", users: funnelStartCount },
      { step: "auth.telegram_verified", users: verifiedSet.size },
      { step: "auth.registration_completed", users: completedSet.size },
      { step: "profile_completed", users: profileSet.size },
      { step: "first_event_or_post", users: activatedSet.size },
      { step: "connect_replied", users: repliedSet.size },
    ].map((item, idx, arr) => {
      const prev = idx === 0 ? item.users : arr[idx - 1].users;
      const conversion = prev > 0 ? Number((item.users / prev).toFixed(4)) : 0;
      const dropoff = prev > 0 ? Number((1 - item.users / prev).toFixed(4)) : 0;
      return { ...item, conversion, dropoff };
    });

    const connectSent24 = countBy(rows24, C.connect_sent);
    const connectSent7 = countBy(rows7, C.connect_sent);
    const connectSent30 = countBy(rows30, C.connect_sent);
    const connectReplied24 = countBy(rows24, C.connect_replied);
    const connectReplied7 = countBy(rows7, C.connect_replied);
    const connectReplied30 = countBy(rows30, C.connect_replied);

    const messages24 = countBy(rows24, C.message_sent);
    const messages7 = countBy(rows7, C.message_sent);
    const messages30 = countBy(rows30, C.message_sent);

    const messagesByUserDay = new Map<string, Set<string>>();
    for (const row of rows30) {
      if (!row.user_id || !C.message_sent.has(row.canonical)) continue;
      const s = messagesByUserDay.get(row.user_id) ?? new Set<string>();
      s.add(dayKey(row.created_at));
      messagesByUserDay.set(row.user_id, s);
    }
    const continuedChatsUsers = [...messagesByUserDay.values()].filter((d) => d.size >= 2).length;

    const summaryPayload = {
      period: {
        from: safeFromISO,
        to: safeToISO,
        days: parsed.data.days,
      },
      kpis: {
        users_total: usersTotal,
        users_new_24h: usersNew24h,
        users_new_7d: usersNew7d,
        users_new_30d: usersNew30d,
        deleted_users_30d: deletedUsers30d,
        demo_users_total: demoUsersTotal,
        profile_completed_rate: pct(profileCompletedCount, usersTotal),
        avg_interests_count: avgInterestsCount,
        facts_filled_rate: pct(factsFilledUsers, usersTotal),
        avatar_rate: pct(avatarCount, usersTotal),
        psychotest_completed_rate: pct(psychCount, usersTotal),

        events_total_24h: rows24.length,
        events_total_7d: rows7.length,
        events_total_30d: rows30.length,
        active_users_24h: distinctUsers(rows24),
        active_users_7d: distinctUsers(rows7),
        active_users_30d: distinctUsers(rows30),
        sessions_24h: countBy(rows24, new Set(["app.session_start"])),
        dau_proxy: distinctUsers(rows24),
        wau_proxy: distinctUsers(rows7),

        posts_duo_24h: countBy(rows24, C.post_duo),
        posts_duo_7d: countBy(rows7, C.post_duo),
        posts_duo_30d: countBy(rows30, C.post_duo),
        posts_video_24h: countBy(rows24, C.post_video),
        posts_video_7d: countBy(rows7, C.post_video),
        posts_video_30d: countBy(rows30, C.post_video),
        comments_24h: countBy(rows24, new Set(["comment_created"])),
        comments_7d: countBy(rows7, new Set(["comment_created"])),
        comments_30d: countBy(rows30, new Set(["comment_created"])),
        posters_7d: new Set(rows7.filter((r) => C.post.has(r.canonical)).map((r) => r.user_id).filter(Boolean) as string[]).size,

        event_viewed_24h: countBy(rows24, C.event_viewed),
        event_viewed_7d: countBy(rows7, C.event_viewed),
        event_viewed_30d: countBy(rows30, C.event_viewed),
        event_joined_24h: countBy(rows24, C.event_joined),
        event_joined_7d: countBy(rows7, C.event_joined),
        event_joined_30d: countBy(rows30, C.event_joined),
        join_rate: pct(countBy(rows30, C.event_joined), countBy(rows30, C.event_viewed)),

        connect_sent_24h: connectSent24,
        connect_sent_7d: connectSent7,
        connect_sent_30d: connectSent30,
        connect_replied_24h: connectReplied24,
        connect_replied_7d: connectReplied7,
        connect_replied_30d: connectReplied30,
        reply_rate: pct(connectReplied30, connectSent30),
        messages_sent_24h: messages24,
        messages_sent_7d: messages7,
        messages_sent_30d: messages30,
        continued_chats_proxy_30d: continuedChatsUsers,

        shadow_banned_count: shadowBannedCount,
        message_limited_count: messageLimitedCount,
        reports_count_24h: countBy(rows24, C.report_created),
        reports_count_7d: countBy(rows7, C.report_created),
        reports_count_30d: countBy(rows30, C.report_created),
        risk_users_count: riskTop.length,

        ai_cost_total_24h: Number(rows24.filter((r) => C.ai_cost.has(r.canonical)).reduce((acc, r) => acc + Number((r.properties?.usd as number | undefined) ?? 0), 0).toFixed(4)),
        ai_cost_total_7d: Number(rows7.filter((r) => C.ai_cost.has(r.canonical)).reduce((acc, r) => acc + Number((r.properties?.usd as number | undefined) ?? 0), 0).toFixed(4)),
        ai_cost_total_30d: Number(rows30.filter((r) => C.ai_cost.has(r.canonical)).reduce((acc, r) => acc + Number((r.properties?.usd as number | undefined) ?? 0), 0).toFixed(4)),
        ai_calls_24h: countBy(rows24, C.ai_request),
        ai_error_rate: pct(countBy(rows30, C.ai_error), Math.max(1, countBy(rows30, C.ai_request))),

        registration_completion_rate: pct(completedSet.size, Math.max(1, funnelStartCount)),
        tg_verify_rate: pct(verifiedSet.size, Math.max(1, funnelStartCount)),
        activation_rate: pct(activatedSet.size, Math.max(1, completedSet.size)),
      },
      tables: {
        top_events_24h: topEntries(topEvents24hMap, 10).map(([event_name, count]) => ({ event_name, count })),
        top_users_30d: topUsers30d,
        cities_30d: cities30d,
        risk_top: riskTop,
        roles_count: [...rolesCountMap.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
        breakdown_by_day: breakdownByDay,
      },
      funnel: {
        steps: funnelSteps,
      },
      warnings,
    };

    summaryCache.set(cacheKey, {
      cachedAt: Date.now(),
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      payload: summaryPayload,
    });

    return ok({
      ...summaryPayload,
      cache: { mode: "fresh", cached_at: new Date().toISOString() },
    });
  } catch (error) {
    try {
      const { searchParams } = new URL(req.url);
      const days = Number(searchParams.get("days") ?? 30);
      const segment = String(searchParams.get("segment") ?? "all");
      const fallback = summaryCache.get(`${days}:${segment}`);
      if (fallback && Date.now() - fallback.cachedAt <= SUMMARY_CACHE_MAX_STALE_MS) {
        return ok({
          ...fallback.payload,
          warnings: [...(fallback.payload?.warnings ?? []), "summary fallback: stale cache used"],
          cache: { mode: "stale", cached_at: new Date(fallback.cachedAt).toISOString() },
        });
      }
    } catch {}
    return adminRouteError("/api/admin/metrics/summary", error);
  }
}
