import { aliasesForCanonicals, canonicalizeEventName, isActivityEventName } from "@/server/event-dictionary";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

export type MetricPoint = { date: string; value: number };
type AnalyticsRow = {
  event_name: string;
  user_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type UserRow = {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  is_demo?: boolean;
  demo_group?: string | null;
  created_at?: string;
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function rangeDays(fromISO: string, toISO: string) {
  const arr: string[] = [];
  const cur = new Date(fromISO);
  const end = new Date(toISO);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    arr.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return arr;
}

function kpi(name: string, value: number, subtitle?: string) {
  return { name, value, subtitle: subtitle ?? null };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function eventCount(rows: AnalyticsRow[], canonical: string | string[]) {
  const set = new Set(Array.isArray(canonical) ? canonical : [canonical]);
  let count = 0;
  for (const row of rows) {
    if (set.has(canonicalizeEventName(row.event_name))) count += 1;
  }
  return count;
}

function uniqueUsers(rows: AnalyticsRow[], canonical?: string | string[]) {
  const setCanonical = canonical
    ? new Set(Array.isArray(canonical) ? canonical : [canonical])
    : null;
  const users = new Set<string>();
  for (const row of rows) {
    if (!row.user_id) continue;
    if (setCanonical && !setCanonical.has(canonicalizeEventName(row.event_name))) continue;
    users.add(row.user_id);
  }
  return users;
}

function buildSeries(
  rows: AnalyticsRow[],
  fromISO: string,
  toISO: string,
  canonicalNames: string[],
): MetricPoint[] {
  const days = rangeDays(fromISO, toISO);
  const map = new Map<string, number>();
  const canonicalSet = new Set(canonicalNames);

  for (const row of rows) {
    if (!canonicalSet.has(canonicalizeEventName(row.event_name))) continue;
    const d = dayKey(row.created_at);
    map.set(d, (map.get(d) ?? 0) + 1);
  }

  return days.map((d) => ({ date: d, value: map.get(d) ?? 0 }));
}

function buildUniqueSeries(
  rows: AnalyticsRow[],
  fromISO: string,
  toISO: string,
  canonicalNames?: string[],
): MetricPoint[] {
  const days = rangeDays(fromISO, toISO);
  const canonicalSet = canonicalNames ? new Set(canonicalNames) : null;
  const map = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.user_id) continue;
    if (canonicalSet && !canonicalSet.has(canonicalizeEventName(row.event_name))) continue;
    const d = dayKey(row.created_at);
    const bucket = map.get(d) ?? new Set<string>();
    bucket.add(row.user_id);
    map.set(d, bucket);
  }

  return days.map((d) => ({ date: d, value: map.get(d)?.size ?? 0 }));
}

function buildWeekdayBreakdown(rows: AnalyticsRow[], canonicalNames?: string[]) {
  const map = new Map<number, number>();
  const canonicalSet = canonicalNames ? new Set(canonicalNames) : null;
  for (let i = 0; i < 7; i += 1) map.set(i, 0);

  for (const row of rows) {
    if (canonicalSet && !canonicalSet.has(canonicalizeEventName(row.event_name))) continue;
    const weekday = new Date(row.created_at).getUTCDay();
    map.set(weekday, (map.get(weekday) ?? 0) + 1);
  }

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels.map((label, i) => ({ key: label, value: map.get(i) ?? 0 }));
}

function findFirstSeenByDay(rows: AnalyticsRow[]) {
  const firstSeen = new Map<string, string>();
  for (const row of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!row.user_id) continue;
    if (!firstSeen.has(row.user_id)) firstSeen.set(row.user_id, dayKey(row.created_at));
  }

  const counts = new Map<string, number>();
  for (const day of firstSeen.values()) {
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function labelUser(userMap: Map<string, UserRow>, id: string) {
  const row = userMap.get(id);
  if (!row) return `User ${id.slice(0, 8)}`;
  return (typeof row.name === "string" && row.name.trim()) ? row.name : `User ${id.slice(0, 8)}`;
}

export async function fetchEventRows(
  fromISO: string,
  toISO: string,
  names?: string[],
  userIds?: string[] | null,
) {
  let q = supabaseAdmin
    .from("analytics_events")
    .select("event_name,user_id,properties,created_at")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: true })
    .limit(160000);

  if (names?.length) q = q.in("event_name", names);
  if (userIds && userIds.length) q = q.in("user_id", userIds);

  const { data } = await q;
  return (data ?? []) as AnalyticsRow[];
}

async function loadUsersMap(userIds: string[]) {
  if (!userIds.length) return new Map<string, UserRow>();

  const schema = await getSchemaSnapshot(["users"]);
  const usersCols = asSet(schema, "users");
  if (!usersCols.has("id")) return new Map<string, UserRow>();

  const selectCols = ["id", "name", "city", "country", "is_demo", "demo_group", "created_at"].filter((c) => usersCols.has(c));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  const { data } = await supabaseAdmin
    .from("users")
    .select(selectCols.join(","))
    .in("id", userIds.slice(0, 5000));

  return new Map<string, UserRow>(((data ?? []) as UserRow[]).map((u) => [u.id, u]));
}

async function loadUsersCreatedSeries(fromISO: string, toISO: string) {
  const schema = await getSchemaSnapshot(["users"]);
  const usersCols = asSet(schema, "users");
  if (!usersCols.has("id") || !usersCols.has("created_at")) return null;

  const { data } = await supabaseAdmin
    .from("users")
    .select("id,created_at")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .limit(120000);

  const seriesMap = new Map<string, number>();
  for (const row of data ?? []) {
    const d = dayKey(row.created_at);
    seriesMap.set(d, (seriesMap.get(d) ?? 0) + 1);
  }

  return seriesMap;
}

function filterByUsers(rows: AnalyticsRow[], userIds?: string[] | null) {
  if (!userIds || !userIds.length) return rows;
  const set = new Set(userIds);
  return rows.filter((r) => r.user_id && set.has(r.user_id));
}

function aiEndpointBreakdown(rows: AnalyticsRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const canonical = canonicalizeEventName(row.event_name);
    if (canonical !== "ai_cost" && canonical !== "ai_error" && !String(row.event_name).startsWith("ai_")) continue;
    const endpoint = String(row.properties?.endpoint ?? row.event_name ?? "unknown");
    map.set(endpoint, (map.get(endpoint) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 10);
}

export async function getMetricsBlock(
  kind: string,
  fromISO: string,
  toISO: string,
  userIds?: string[] | null,
) {
  const rowsRaw = await fetchEventRows(fromISO, toISO, undefined, null);
  const rows = filterByUsers(rowsRaw, userIds);
  const activityRows = rows.filter((r) => isActivityEventName(r.event_name));
  const days = rangeDays(fromISO, toISO);

  const activeUsers = uniqueUsers(activityRows).size
  const messages = eventCount(rows, "message_sent");
  const sent = eventCount(rows, "connect_sent");
  const replied = eventCount(rows, "connect_replied");
  const duo = eventCount(rows, "post_published_daily_duo");
  const video = eventCount(rows, "post_published_video");
  const viewed = eventCount(rows, "event_viewed");
  const joined = eventCount(rows, "event_joined");
  const reportsCount = eventCount(rows, "report_created");

  const userIdsFromRows = [...uniqueUsers(rows)];
  const userMap = await loadUsersMap(userIdsFromRows);

  const fallbackNewUsersMap = findFirstSeenByDay(rows);
  const usersCreatedMap = await loadUsersCreatedSeries(fromISO, toISO);
  const newUsersMap = usersCreatedMap ?? fallbackNewUsersMap;

  const newUsersSeries = days.map((d) => ({ date: d, value: newUsersMap.get(d) ?? 0 }));

  const regStarted = eventCount(rows, "register_started");
  const tgVerified = eventCount(rows, "telegram_verified");
  const regCompleted = eventCount(rows, "registration_completed");
  const profileCompleted = eventCount(rows, "profile_completed");

  const dauSeries = buildUniqueSeries(activityRows, fromISO, toISO);
  const postsSeries = buildSeries(rows, fromISO, toISO, ["post_published_daily_duo", "post_published_video"]);
  const connectReplySeries = buildSeries(rows, fromISO, toISO, ["connect_replied"]);

  const todayDAU = dauSeries[dauSeries.length - 1]?.value ?? 0;
  const wau = new Set(activityRows.filter((r) => new Date(r.created_at).getTime() >= (Date.now() - 7 * 24 * 60 * 60 * 1000) && r.user_id).map((r) => String(r.user_id))).size;
  const mau = new Set(activityRows.filter((r) => new Date(r.created_at).getTime() >= (Date.now() - 30 * 24 * 60 * 60 * 1000) && r.user_id).map((r) => String(r.user_id))).size;

  const topByCanonical = (canonical: string, limit = 10) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.user_id) continue;
      if (canonicalizeEventName(row.event_name) !== canonical) continue;
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([user_id, value]) => ({ user_id, value, name: labelUser(userMap, user_id) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  };

  const reportReasons = new Map<string, number>();
  for (const row of rows) {
    if (canonicalizeEventName(row.event_name) !== "report_created") continue;
    const reason = String(row.properties?.reason ?? "unknown");
    reportReasons.set(reason, (reportReasons.get(reason) ?? 0) + 1);
  }

  const topEventIds = new Map<string, number>();
  for (const row of rows) {
    const canonical = canonicalizeEventName(row.event_name);
    if (canonical !== "event_joined" && canonical !== "event_viewed") continue;
    const eid = String(row.properties?.event_id ?? "").trim();
    if (!eid) continue;
    topEventIds.set(eid, (topEventIds.get(eid) ?? 0) + 1);
  }

  const topEventRows = [...topEventIds.entries()]
    .map(([event_id, value]) => ({ event_id, value, title: `Event ${event_id.slice(0, 8)}` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const insufficient = activityRows.length === 0;

  if (kind === "growth") {
    const byCity = new Map<string, number>();
    for (const [uid, day] of [...fallbackNewUsersMap.entries()].map(([u, d]) => [u, d] as const)) {
      const user = userMap.get(uid);
      const city = user?.city ?? user?.country ?? "unknown";
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
      void day;
    }

    return {
      kpis: [
        kpi("Новые пользователи / день", Number((newUsersSeries.reduce((a, p) => a + p.value, 0) / Math.max(1, newUsersSeries.length)).toFixed(2)), usersCreatedMap ? "users.created_at" : "proxy from analytics_events"),
        kpi("TG Verify Rate", regStarted > 0 ? Number((tgVerified / regStarted).toFixed(4)) : 0),
        kpi("Registration Completion", regStarted > 0 ? Number((regCompleted / regStarted).toFixed(4)) : 0),
        kpi("Profile Completion", regCompleted > 0 ? Number((profileCompleted / regCompleted).toFixed(4)) : 0),
        kpi("Register Started", regStarted),
        kpi("Registration Completed", regCompleted),
      ],
      trends: [
        { key: "new_users", points: newUsersSeries },
        {
          key: "verify_rate",
          points: days.map((d) => {
            const dayRows = rows.filter((r) => dayKey(r.created_at) === d);
            const rs = eventCount(dayRows, "register_started");
            const tv = eventCount(dayRows, "telegram_verified");
            return { date: d, value: rs > 0 ? Number((tv / rs).toFixed(4)) : 0 };
          }),
        },
      ],
      breakdowns: [
        {
          key: "city_or_demo_group",
          items: [...byCity.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 10),
        },
      ],
      top: [...newUsersSeries].sort((a, b) => b.value - a.value).slice(0, 10).map((x) => ({ key: x.date, value: x.value })),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "activation") {
    const firstActionUsers = uniqueUsers(rows, ["post_published_daily_duo", "post_published_video", "event_joined"]).size;
    const replyUsers = uniqueUsers(rows, "connect_replied").size;
    const base = Math.max(1, uniqueUsers(rows, "registration_completed").size || activeUsers);

    return {
      kpis: [
        kpi("% users with first_post", Number((uniqueUsers(rows, ["post_published_daily_duo", "post_published_video"]).size / base).toFixed(4))),
        kpi("% users joined event", Number((uniqueUsers(rows, "event_joined").size / base).toFixed(4))),
        kpi("% users with first reply", Number((replyUsers / base).toFixed(4))),
        kpi("First actions users", firstActionUsers),
        kpi("Users stuck before activation", Math.max(0, base - firstActionUsers)),
      ],
      trends: [
        { key: "first_action", points: buildSeries(rows, fromISO, toISO, ["post_published_daily_duo", "post_published_video", "event_joined"]) },
        { key: "first_reply", points: buildSeries(rows, fromISO, toISO, ["connect_replied"]) },
      ],
      breakdowns: [
        {
          key: "median_time_to_first_action_min",
          items: [{ key: "median", value: 0 }],
        },
      ],
      top: topByCanonical("registration_completed", 20).filter((u) => !topByCanonical("post_published_daily_duo", 1000).some((p) => p.user_id === u.user_id)).slice(0, 10),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "engagement") {
    const wauSeries = days.map((d) => {
      const end = new Date(d + "T23:59:59.999Z").getTime();
      const start = end - 6 * 24 * 60 * 60 * 1000;
      const bucket = new Set<string>();
      for (const row of rows) {
        if (!row.user_id) continue;
        const ts = new Date(row.created_at).getTime();
        if (ts >= start && ts <= end) bucket.add(row.user_id);
      }
      return { date: d, value: bucket.size };
    });

    return {
      kpis: [
        kpi("DAU", todayDAU),
        kpi("WAU", wau),
        kpi("MAU", mau),
        kpi("Stickiness (DAU/MAU)", mau > 0 ? Number((todayDAU / mau).toFixed(4)) : 0),
        kpi("Active users", activeUsers),
        kpi("Events per user", activeUsers > 0 ? Number((rows.length / activeUsers).toFixed(2)) : 0),
      ],
      trends: [
        { key: "dau", points: dauSeries },
        { key: "wau", points: wauSeries },
      ],
      breakdowns: [{ key: "activity_by_weekday", items: buildWeekdayBreakdown(rows) }],
      top: topByCanonical("message_sent", 10),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "content") {
    return {
      kpis: [
        kpi("posts_daily_duo", duo),
        kpi("posts_video", video),
        kpi("posts_per_active_user", activeUsers > 0 ? Number(((duo + video) / activeUsers).toFixed(3)) : 0),
        kpi("weekly_posters_%", activeUsers > 0 ? Number((uniqueUsers(rows, ["post_published_daily_duo", "post_published_video"]).size / activeUsers).toFixed(4)) : 0),
      ],
      trends: [
        { key: "posts", points: postsSeries },
        { key: "duo_vs_video", points: days.map((d) => ({ date: d, value: eventCount(rows.filter((r) => dayKey(r.created_at) === d), "post_published_daily_duo") - eventCount(rows.filter((r) => dayKey(r.created_at) === d), "post_published_video") })) },
      ],
      breakdowns: [{ key: "by_type", items: [{ key: "daily_duo", value: duo }, { key: "video", value: video }] }],
      top: topByCanonical("post_published_daily_duo", 10),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "events") {
    return {
      kpis: [
        kpi("events.viewed", viewed),
        kpi("events.joined", joined),
        kpi("join_rate", viewed > 0 ? Number((joined / viewed).toFixed(4)) : 0),
        kpi("top_events_found", topEventRows.length),
      ],
      trends: [
        { key: "views", points: buildSeries(rows, fromISO, toISO, ["event_viewed"]) },
        { key: "joins", points: buildSeries(rows, fromISO, toISO, ["event_joined"]) },
      ],
      breakdowns: [{ key: "views_to_joins", items: [{ key: "views", value: viewed }, { key: "joins", value: joined }] }],
      top: topEventRows,
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "social") {
    const replyRate = sent > 0 ? Number((replied / sent).toFixed(4)) : 0;
    const replyTimes: number[] = [];
    for (const row of rows) {
      if (canonicalizeEventName(row.event_name) !== "message_sent") continue;
      const val = Number(row.properties?.reply_minutes ?? 0);
      if (Number.isFinite(val) && val > 0) replyTimes.push(val);
    }

    const continuedD1 = (() => {
      const connectDayByUser = new Map<string, Set<string>>();
      const msgDayByUser = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!row.user_id) continue;
        const day = dayKey(row.created_at);
        const canonical = canonicalizeEventName(row.event_name);
        if (canonical === "connect_replied") {
          const set = connectDayByUser.get(row.user_id) ?? new Set<string>();
          set.add(day);
          connectDayByUser.set(row.user_id, set);
        }
        if (canonical === "message_sent") {
          const set = msgDayByUser.get(row.user_id) ?? new Set<string>();
          set.add(day);
          msgDayByUser.set(row.user_id, set);
        }
      }

      let total = 0;
      for (const [uid, cDays] of connectDayByUser.entries()) {
        const mDays = msgDayByUser.get(uid) ?? new Set<string>();
        const ok = [...cDays].some((d) => {
          const next = new Date(d + "T00:00:00.000Z");
          next.setUTCDate(next.getUTCDate() + 1);
          return mDays.has(next.toISOString().slice(0, 10));
        });
        if (ok) total += 1;
      }
      return total;
    })();

    return {
      kpis: [
        kpi("connect_sent", sent),
        kpi("connect_replied", replied),
        kpi("reply_rate", replyRate),
        kpi("continued_d1", continuedD1),
        kpi("median_reply_time_min", Number(median(replyTimes).toFixed(2))),
        kpi("WMC_weekly", messages),
      ],
      trends: [
        { key: "connect_replied", points: connectReplySeries },
        { key: "connect_sent", points: buildSeries(rows, fromISO, toISO, ["connect_sent"]) },
      ],
      breakdowns: [{ key: "chat_death_1d", items: [{ key: "continued_d1", value: continuedD1 }, { key: "not_continued", value: Math.max(0, replied - continuedD1) }] }],
      top: [
        ...topByCanonical("connect_sent", 5).map((x) => ({ ...x, type: "sent" })),
        ...topByCanonical("connect_replied", 5).map((x) => ({ ...x, type: "replied" })),
      ],
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "safety") {
    const schema = await getSchemaSnapshot(["users", "risk_signals", "reports"]);
    const usersCols = asSet(schema, "users");
    const riskCols = asSet(schema, "risk_signals");

    let blocked = 0;
    if (usersCols.has("id") && usersCols.has("is_blocked")) {
      const r = await supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true);
      blocked = r.count ?? 0;
    }

    let riskyUsers = 0;
    if (riskCols.has("id") && riskCols.has("user_id") && riskCols.has("created_at")) {
      const rs = await supabaseAdmin.from("risk_signals").select("user_id").gte("created_at", fromISO).lte("created_at", toISO).limit(50000);
      riskyUsers = new Set((rs.data ?? []).map((x: any) => x.user_id).filter(Boolean)).size;
    }

    const reasonList = [...reportReasons.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    return {
      kpis: [
        kpi("reports_created", reportsCount),
        kpi("blocked_users", blocked),
        kpi("risky_users", riskyUsers),
        kpi("reports_per_1k_users", activeUsers > 0 ? Number(((reportsCount / activeUsers) * 1000).toFixed(2)) : 0),
      ],
      trends: [{ key: "reports", points: buildSeries(rows, fromISO, toISO, ["report_created"]) }],
      breakdowns: [{ key: "report_reasons", items: reasonList }],
      top: topByCanonical("report_created", 10),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "ai") {
    let aiReq = 0;
    let aiErr = 0;
    let aiCost = 0;

    for (const row of rows) {
      const canonical = canonicalizeEventName(row.event_name);
      if (canonical === "ai_error") aiErr += 1;
      if (canonical === "ai_cost") {
        aiReq += 1;
        aiCost += Number(row.properties?.usd ?? 0);
      } else if (String(row.event_name).startsWith("ai_")) {
        aiReq += 1;
      }
    }

    return {
      kpis: [
        kpi("ai_requests", aiReq),
        kpi("ai_error_rate", aiReq > 0 ? Number((aiErr / aiReq).toFixed(4)) : 0),
        kpi("ai_cost_usd", Number(aiCost.toFixed(4))),
      ],
      trends: [{ key: "ai_requests", points: buildSeries(rows, fromISO, toISO, ["ai_cost", "ai_error"]) }],
      breakdowns: [{ key: "by_endpoint", items: aiEndpointBreakdown(rows) }],
      top: aiEndpointBreakdown(rows),
      status: insufficient ? "insufficient" : "ok",
    };
  }

  if (kind === "health") {
    const lastHour = rows.filter((r) => new Date(r.created_at).getTime() >= Date.now() - 60 * 60 * 1000).length;
    const apiErrors = rows.filter((r) => canonicalizeEventName(r.event_name) === "api_error" || String(r.event_name) === "api_error").length;

    return {
      kpis: [
        kpi("events_per_day", Number((rows.length / Math.max(1, days.length)).toFixed(2))),
        kpi("events_last_1h", lastHour),
        kpi("api_error_rate", rows.length > 0 ? Number((apiErrors / rows.length).toFixed(4)) : 0),
        kpi("pipeline_healthy", lastHour > 0 ? 1 : 0, lastHour > 0 ? "healthy" : "0 events in last 60m"),
      ],
      trends: [{ key: "events", points: days.map((d) => ({ date: d, value: rows.filter((r) => dayKey(r.created_at) === d).length })) }],
      breakdowns: [{ key: "status", items: [{ key: "ok", value: lastHour > 0 ? 1 : 0 }, { key: "alert", value: lastHour > 0 ? 0 : 1 }] }],
      top: [{ key: "latest_event", value: rows[rows.length - 1]?.created_at ?? null }],
      status: insufficient ? "insufficient" : "ok",
    };
  }

  return {
    kpis: [kpi("insufficient", 0, "unknown metrics tab")],
    trends: [{ key: "empty", points: days.map((d) => ({ date: d, value: 0 })) }],
    breakdowns: [],
    top: [],
    status: "insufficient",
  };
}

export function eventAliasesForFunnelStep(step: string) {
  if (step === "register_started") return aliasesForCanonicals(["register_started"]);
  if (step === "telegram_verified") return aliasesForCanonicals(["telegram_verified"]);
  if (step === "registration_completed") return aliasesForCanonicals(["registration_completed"]);
  if (step === "profile_completed") return aliasesForCanonicals(["profile_completed"]);
  if (step === "first_post") return aliasesForCanonicals(["post_published_daily_duo", "post_published_video"]);
  if (step === "event_joined") return aliasesForCanonicals(["event_joined"]);
  if (step === "connect_replied") return aliasesForCanonicals(["connect_replied"]);
  return [step];
}
