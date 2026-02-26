import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow, getSegmentUserIds, filterCountByUsers } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";
import { getServerEnv } from "@/lib/env";

async function countEvents(eventName: string, fromISO: string, toISO: string, userIds: string[] | null) {
  const query = supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", eventName)
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (userIds && userIds.length) query.in("user_id", userIds);
  const { count } = await query;
  return count ?? 0;
}

async function countAny(eventNames: string[], fromISO: string, toISO: string, userIds: string[] | null) {
  const query = supabaseAdmin
    .from("analytics_events")
    .select("event_name,user_id", { count: "exact" })
    .in("event_name", eventNames)
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (userIds && userIds.length) query.in("user_id", userIds);

  const { count, data } = await query;
  return { count: count ?? 0, rows: data ?? [] };
}

async function sumNumericProperty(eventName: string, property: string, fromISO: string, toISO: string) {
  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("properties")
    .eq("event_name", eventName)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .limit(5000);

  let sum = 0;
  for (const row of data ?? []) {
    const value = Number((row.properties as Record<string, unknown> | null)?.[property] ?? 0);
    if (Number.isFinite(value)) sum += value;
  }
  return Number(sum.toFixed(3));
}

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function buildDailyTrend(rows: Array<{ created_at: string; event_name: string }>, names: string[], fromISO: string, toISO: string) {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const map = new Map<string, number>();

  for (const row of rows) {
    if (!names.includes(row.event_name)) continue;
    const key = dateKey(row.created_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const out: Array<{ date: string; value: number }> = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, value: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function percentDiff(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 1 : 0;
  return Number(((current - previous) / previous).toFixed(3));
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = metricsQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
    });

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);
    const userIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);

    const now = new Date();
    const d1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const fromDate = new Date(fromISO);
    const toDate = new Date(toISO);
    const rangeMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - rangeMs).toISOString();
    const prevTo = new Date(fromDate.getTime()).toISOString();

    const [
      usersTotal,
      newUsers1d,
      newUsers7d,
      verifiedUsers,
      dau,
      wau,
      mau,
      registerStarted,
      telegramVerified,
      registrationCompleted,
      dailyDuo1d,
      dailyDuo7d,
      videoPosts1d,
      videoPosts7d,
      eventJoin1d,
      eventJoin7d,
      connectClicked,
      chatsStarted,
      reportsOpen,
      flagsOpen,
      blockedUsers,
      wmc,
      apiErrors1d,
      aiCalls7d,
      aiCostUsd7d,
      analyticsRows,
      registerStartedPrev,
      registrationCompletedPrev,
      connectSentPrev,
      wmcPrev,
      actions,
      integrationsErrors,
      latencyRows,
      miniFunnelRows,
    ] = await Promise.all([
      filterCountByUsers("users", "id", fromISO, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d1, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d7, toISO, userIds, "created_at"),
      (() => {
        const q = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("telegram_verified", true);
        if (userIds && userIds.length) q.in("id", userIds);
        return q.then((x) => x.count ?? 0);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d1);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d7);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d30);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      countEvents("register_started", fromISO, toISO, userIds),
      countEvents("telegram_verified", fromISO, toISO, userIds),
      countEvents("registration_completed", fromISO, toISO, userIds),
      countAny(["daily_duo_published", "post_published_daily_duo"], d1, toISO, userIds).then((x) => x.count),
      countAny(["daily_duo_published", "post_published_daily_duo"], d7, toISO, userIds).then((x) => x.count),
      countEvents("post_published_video", d1, toISO, userIds),
      countEvents("post_published_video", d7, toISO, userIds),
      countEvents("event_joined", d1, toISO, userIds),
      countEvents("event_joined", d7, toISO, userIds),
      countAny(["connect_clicked", "connect_sent"], fromISO, toISO, userIds).then((x) => x.count),
      countAny(["first_message_sent", "chat_message_sent", "connect_replied"], fromISO, toISO, userIds).then((x) => x.count),
      supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open").then((x) => x.count ?? 0),
      supabaseAdmin.from("content_flags").select("id", { count: "exact", head: true }).eq("status", "open").then((x) => x.count ?? 0),
      (() => {
        const q = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true);
        if (userIds && userIds.length) q.in("id", userIds);
        return q.then((x) => x.count ?? 0);
      })(),
      countEvents("chat_message_sent", d7, toISO, userIds),
      countEvents("api_error", d1, toISO, null),
      countAny(["ai_face_validate", "ai_icebreaker", "ai_admin_insights"], d7, toISO, null).then((x) => x.count),
      sumNumericProperty("ai_cost", "usd", d7, toISO),
      supabaseAdmin
        .from("analytics_events")
        .select("event_name,created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(50000)
        .then((x) => x.data ?? []),
      countEvents("register_started", prevFrom, prevTo, userIds),
      countEvents("registration_completed", prevFrom, prevTo, userIds),
      countAny(["connect_clicked", "connect_sent"], prevFrom, prevTo, userIds).then((x) => x.count),
      countEvents("chat_message_sent", new Date(new Date(prevTo).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), prevTo, userIds),
      supabaseAdmin.from("moderation_actions").select("id,action,reason,created_at,admin_user_id").order("created_at", { ascending: false }).limit(8).then((x) => x.data ?? []),
      supabaseAdmin.from("analytics_events").select("event_name", { count: "exact", head: true }).in("event_name", ["api_error", "ai_error", "telegram_verify_error"]).gte("created_at", d7).then((x) => x.count ?? 0),
      supabaseAdmin.from("analytics_events").select("properties").eq("event_name", "api_latency_ms").gte("created_at", d7).limit(6000).then((x) => x.data ?? []),
      countAny([
        "register_started",
        "telegram_verified",
        "registration_completed",
        "profile_completed",
        "first_post",
        "connect_replied",
      ], fromISO, toISO, userIds).then((x) => x.rows),
    ]);

    const dauMau = mau > 0 ? Number((dau / mau).toFixed(3)) : 0;

    const trendRows = analyticsRows as Array<{ event_name: string; created_at: string }>;
    const trends = {
      dau: buildDailyTrend(trendRows, ["chat_message_sent", "connect_sent", "event_joined", "post_published_daily_duo"], fromISO, toISO),
      posts: buildDailyTrend(trendRows, ["post_published_daily_duo", "post_published_video", "daily_duo_published"], fromISO, toISO),
      connectReplied: buildDailyTrend(trendRows, ["connect_replied", "first_message_sent"], fromISO, toISO),
    };

    const usersByStep = new Map<string, Set<string>>();
    for (const step of ["register_started", "telegram_verified", "registration_completed", "profile_completed", "first_post", "connect_replied"]) {
      usersByStep.set(step, new Set());
    }
    for (const row of miniFunnelRows as Array<{ event_name: string; user_id: string | null }>) {
      if (!row.user_id) continue;
      const set = usersByStep.get(row.event_name);
      if (!set) continue;
      set.add(row.user_id);
    }

    const funnelOrder = ["register_started", "telegram_verified", "registration_completed", "profile_completed", "first_post", "connect_replied"];
    const miniFunnel = funnelOrder.map((step, idx) => {
      const count = usersByStep.get(step)?.size ?? 0;
      const prev = idx > 0 ? usersByStep.get(funnelOrder[idx - 1])?.size ?? 0 : count;
      return {
        step,
        count,
        conversion: prev > 0 ? Number((count / prev).toFixed(3)) : 0,
      };
    });

    const latencyVals = (latencyRows as Array<{ properties: Record<string, unknown> }>).map((r) => Number(r.properties?.ms ?? 0)).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
    const p95Latency = latencyVals.length ? latencyVals[Math.floor(latencyVals.length * 0.95) - 1] ?? latencyVals[latencyVals.length - 1] : 0;

    const env = getServerEnv();

    return ok({
      range: { from: fromISO, to: toISO, segment: parsed.data.segment },
      overview: {
        usersTotal,
        dau,
        wau,
        mau,
        dauMau,
        newUsers1d,
        newUsers7d,
        telegramVerifiedRate: registerStarted > 0 ? Number((telegramVerified / registerStarted).toFixed(3)) : 0,
        registrationCompletedRate: registerStarted > 0 ? Number((registrationCompleted / registerStarted).toFixed(3)) : 0,
        profileCompletionRate: registrationCompleted > 0
          ? Number(((usersByStep.get("profile_completed")?.size ?? 0) / registrationCompleted).toFixed(3))
          : 0,
        verifiedUsers,
        dailyDuo1d,
        dailyDuo7d,
        videoPosts1d,
        videoPosts7d,
        eventJoin1d,
        eventJoin7d,
        connectClicked,
        chatsStarted,
        wmc,
        reportsOpen,
        flagsOpen,
        blockedUsers,
        apiErrors1d,
        aiCalls7d,
        aiCostUsd7d,
        offlineConversion: 0,
        matchesStarted: connectClicked,
        continuedD1: chatsStarted,
      },
      comparisons: {
        registerStartedDiff: percentDiff(registerStarted, registerStartedPrev),
        registrationDiff: percentDiff(registrationCompleted, registrationCompletedPrev),
        connectDiff: percentDiff(connectClicked, connectSentPrev),
        wmcDiff: percentDiff(wmc, wmcPrev),
      },
      trends,
      miniFunnel,
      health: {
        p95Latency,
        integrations: {
          telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
          openAiConfigured: Boolean(env.OPENAI_API_KEY),
          supabaseConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
          integrationErrors7d: integrationsErrors,
        },
        lastAdminActions: actions,
      },
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
