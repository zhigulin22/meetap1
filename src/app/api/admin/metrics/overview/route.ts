import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow, getSegmentUserIds, filterCountByUsers } from "@/server/admin-metrics";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { aliasesForCanonicals, canonicalizeEventName } from "@/server/event-dictionary";
import { computeSeries } from "@/server/metrics-series";
import { supabaseAdmin } from "@/supabase/admin";
import { getServerEnv } from "@/lib/env";

async function countByAliases(aliases: string[], fromISO: string, toISO: string, userIds: string[] | null) {
  const query = supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .in("event_name", aliases)
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (userIds && userIds.length) query.in("user_id", userIds);
  const { count } = await query;
  return count ?? 0;
}

async function countUsersByBooleanColumn(
  usersCols: Set<string>,
  column: string,
  value: boolean,
  userIds: string[] | null,
) {
  if (!usersCols.has("id") || !usersCols.has(column)) return 0;
  let query = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq(column, value);
  if (userIds && userIds.length) query = query.in("id", userIds);
  const { count } = await query;
  return count ?? 0;
}

async function countUniqueActiveUsers(fromISO: string, toISO: string, userIds: string[] | null) {
  const aliases = aliasesForCanonicals([
        "event_viewed",
    "event_joined",
    "post_published_daily_duo",
    "post_published_video",
    "connect_sent",
    "connect_replied",
    "message_sent",
  ]);

  const query = supabaseAdmin
    .from("analytics_events")
    .select("user_id")
    .in("event_name", aliases)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .not("user_id", "is", null)
    .limit(150000);

  if (userIds && userIds.length) query.in("user_id", userIds);

  const { data } = await query;
  return new Set((data ?? []).map((x: any) => x.user_id).filter(Boolean) as string[]).size;
}

async function sumAiCost(fromISO: string, toISO: string, userIds: string[] | null) {
  const aliases = aliasesForCanonicals(["ai_cost"]);
  const query = supabaseAdmin
    .from("analytics_events")
    .select("properties,user_id,event_name")
    .in("event_name", aliases)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .limit(150000);

  if (userIds && userIds.length) query.in("user_id", userIds);

  const { data } = await query;
  let sum = 0;
  for (const row of data ?? []) {
    if (canonicalizeEventName(row.event_name) !== "ai_cost") continue;
    const value = Number((row.properties as Record<string, unknown> | null)?.usd ?? 0);
    if (Number.isFinite(value)) sum += value;
  }
  return Number(sum.toFixed(4));
}

function buildMiniFunnel(rows: Array<{ event_name: string; user_id: string | null }>) {
  const usersByStep = new Map<string, Set<string>>([
    ["register_started", new Set()],
    ["telegram_verified", new Set()],
    ["registration_completed", new Set()],
    ["profile_completed", new Set()],
    ["first_post", new Set()],
    ["connect_replied", new Set()],
  ]);

  for (const row of rows) {
    if (!row.user_id) continue;
    const canonical = canonicalizeEventName(row.event_name);
    const step =
      canonical === "post_published_daily_duo" || canonical === "post_published_video"
        ? "first_post"
        : ["register_started", "telegram_verified", "registration_completed", "profile_completed", "connect_replied"].includes(canonical)
          ? canonical
          : null;
    if (!step) continue;
    usersByStep.get(step)?.add(row.user_id);
  }

  const order = ["register_started", "telegram_verified", "registration_completed", "profile_completed", "first_post", "connect_replied"];
  return order.map((step, idx) => {
    const count = usersByStep.get(step)?.size ?? 0;
    const prev = idx > 0 ? usersByStep.get(order[idx - 1])?.size ?? 0 : count;
    return {
      step,
      count,
      conversion: prev > 0 ? Number((count / prev).toFixed(4)) : 0,
    };
  });
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
    const usersSchema = await getSchemaSnapshot(["users"]);
    const usersCols = asSet(usersSchema, "users");

    const now = Date.now();
    const d1 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const fromDate = new Date(fromISO);
    const toDate = new Date(toISO);
    const rangeMs = Math.max(1, toDate.getTime() - fromDate.getTime());
    const prevFrom = new Date(fromDate.getTime() - rangeMs).toISOString();
    const prevTo = fromDate.toISOString();

    const aliases = {
      registerStarted: aliasesForCanonicals(["register_started"]),
      telegramVerified: aliasesForCanonicals(["telegram_verified"]),
      registrationCompleted: aliasesForCanonicals(["registration_completed"]),
      profileCompleted: aliasesForCanonicals(["profile_completed"]),
      dailyDuo: aliasesForCanonicals(["post_published_daily_duo"]),
      video: aliasesForCanonicals(["post_published_video"]),
      eventJoin: aliasesForCanonicals(["event_joined"]),
      connectSent: aliasesForCanonicals(["connect_sent"]),
      connectReply: aliasesForCanonicals(["connect_replied"]),
      aiCalls: aliasesForCanonicals(["ai_face_validate", "ai_icebreaker", "ai_admin_insights"]),
      apiErrors: aliasesForCanonicals(["api_error"]),
      integrationErrors: aliasesForCanonicals(["api_error", "ai_error", "telegram_verify_error"]),
      funnelRows: aliasesForCanonicals(["register_started", "telegram_verified", "registration_completed", "profile_completed", "post_published_daily_duo", "post_published_video", "connect_replied"]),
    };

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
      profileCompleted,
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
      registerStartedPrev,
      registrationCompletedPrev,
      connectSentPrev,
      wmcPrev,
      actions,
      integrationsErrors,
      latencyRows,
      miniFunnelRows,
      trendsDau,
      trendsPosts,
      trendsConnect,
    ] = await Promise.all([
      filterCountByUsers("users", "id", fromISO, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d1, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d7, toISO, userIds, "created_at"),
      countUsersByBooleanColumn(usersCols, "telegram_verified", true, userIds),
      countUniqueActiveUsers(d1, toISO, userIds),
      countUniqueActiveUsers(d7, toISO, userIds),
      countUniqueActiveUsers(d30, toISO, userIds),
      countByAliases(aliases.registerStarted, fromISO, toISO, userIds),
      countByAliases(aliases.telegramVerified, fromISO, toISO, userIds),
      countByAliases(aliases.registrationCompleted, fromISO, toISO, userIds),
      countByAliases(aliases.profileCompleted, fromISO, toISO, userIds),
      countByAliases(aliases.dailyDuo, d1, toISO, userIds),
      countByAliases(aliases.dailyDuo, d7, toISO, userIds),
      countByAliases(aliases.video, d1, toISO, userIds),
      countByAliases(aliases.video, d7, toISO, userIds),
      countByAliases(aliases.eventJoin, d1, toISO, userIds),
      countByAliases(aliases.eventJoin, d7, toISO, userIds),
      countByAliases(aliases.connectSent, fromISO, toISO, userIds),
      countByAliases(aliases.connectReply, fromISO, toISO, userIds),
      supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open").then((x: any) => x.count ?? 0),
      supabaseAdmin.from("content_flags").select("id", { count: "exact", head: true }).eq("status", "open").then((x: any) => x.count ?? 0),
      countUsersByBooleanColumn(usersCols, "is_blocked", true, userIds),
      countByAliases(aliases.connectReply, d7, toISO, userIds),
      countByAliases(aliases.apiErrors, d1, toISO, null),
      countByAliases(aliases.aiCalls, d7, toISO, null),
      sumAiCost(d7, toISO, userIds),
      countByAliases(aliases.registerStarted, prevFrom, prevTo, userIds),
      countByAliases(aliases.registrationCompleted, prevFrom, prevTo, userIds),
      countByAliases(aliases.connectSent, prevFrom, prevTo, userIds),
      countByAliases(aliases.connectReply, new Date(new Date(prevTo).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), prevTo, userIds),
      supabaseAdmin.from("moderation_actions").select("id,action,reason,created_at,admin_user_id").order("created_at", { ascending: false }).limit(8).then((x: any) => x.data ?? []),
      countByAliases(aliases.integrationErrors, d7, toISO, null),
      supabaseAdmin.from("analytics_events").select("properties").eq("event_name", "api_latency_ms").gte("created_at", d7).limit(6000).then((x: any) => x.data ?? []),
      supabaseAdmin.from("analytics_events").select("event_name,user_id").in("event_name", aliases.funnelRows).gte("created_at", fromISO).lte("created_at", toISO).limit(120000).then((x: any) => x.data ?? []),
      computeSeries({ metric: "dau", fromISO, toISO, userIds }),
      computeSeries({ metric: "posts", fromISO, toISO, userIds }),
      computeSeries({ metric: "connect_replied", fromISO, toISO, userIds }),
    ]);

    const miniFunnel = buildMiniFunnel((miniFunnelRows ?? []).filter((x: any) => !userIds || (x.user_id && userIds.includes(x.user_id))));

    const latencyVals = (latencyRows as Array<{ properties: Record<string, unknown> }>)
      .map((r: any) => Number(r.properties?.ms ?? 0))
      .filter((x: any) => Number.isFinite(x) && x > 0)
      .sort((a: any, b: any) => a - b);
    const p95Latency = latencyVals.length ? latencyVals[Math.floor(latencyVals.length * 0.95) - 1] ?? latencyVals[latencyVals.length - 1] : 0;

    const env = getServerEnv();

    return ok({
      range: { from: fromISO, to: toISO, segment: parsed.data.segment },
      overview: {
        usersTotal,
        dau,
        wau,
        mau,
        dauMau: mau > 0 ? Number((dau / mau).toFixed(4)) : 0,
        newUsers1d,
        newUsers7d,
        telegramVerifiedRate: registerStarted > 0 ? Number((telegramVerified / registerStarted).toFixed(4)) : 0,
        registrationCompletedRate: registerStarted > 0 ? Number((registrationCompleted / registerStarted).toFixed(4)) : 0,
        profileCompletionRate: registrationCompleted > 0 ? Number((profileCompleted / registrationCompleted).toFixed(4)) : 0,
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
      trends: {
        dau: trendsDau.points.map((p: any) => ({ date: p.ts, value: p.value })),
        posts: trendsPosts.points.map((p: any) => ({ date: p.ts, value: p.value })),
        connectReplied: trendsConnect.points.map((p: any) => ({ date: p.ts, value: p.value })),
      },
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
  } catch (error) {
    return adminRouteError("/api/admin/metrics/overview", error);
  }
}
