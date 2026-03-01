import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { canonicalizeEventName, isActivityEventName } from "@/server/event-dictionary";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";
import { DEFAULT_HELP_TEXTS, kpiSource } from "@/lib/admin-help-texts";

type EventRow = {
  event_name: string;
  user_id: string | null;
  created_at: string;
  properties: Record<string, unknown> | null;
};

type UserRow = {
  id: string;
  city?: string | null;
  is_demo?: boolean | null;
  demo_group?: string | null;
  created_at?: string | null;
};

const querySchema = z.object({
  metric: z.string().min(1),
  days: z.coerce.number().int().min(1).max(180).default(30),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
});

const METRIC_MAP: Record<string, { mode: "count" | "distinct" | "ratio"; events?: string[]; numerator?: string[]; denominator?: string[] }> = {
  dau_proxy: { mode: "distinct" },
  wau_proxy: { mode: "distinct" },
  sessions_24h: { mode: "count", events: ["app.session_start"] },
  posts_duo_24h: { mode: "count", events: ["post_published_daily_duo"] },
  posts_duo_7d: { mode: "count", events: ["post_published_daily_duo"] },
  posts_duo_30d: { mode: "count", events: ["post_published_daily_duo"] },
  posts_video_24h: { mode: "count", events: ["post_published_video"] },
  posts_video_7d: { mode: "count", events: ["post_published_video"] },
  posts_video_30d: { mode: "count", events: ["post_published_video"] },
  event_viewed_24h: { mode: "count", events: ["event_viewed"] },
  event_viewed_7d: { mode: "count", events: ["event_viewed"] },
  event_viewed_30d: { mode: "count", events: ["event_viewed"] },
  event_joined_24h: { mode: "count", events: ["event_joined"] },
  event_joined_7d: { mode: "count", events: ["event_joined"] },
  event_joined_30d: { mode: "count", events: ["event_joined"] },
  connect_sent_24h: { mode: "count", events: ["connect_sent"] },
  connect_sent_7d: { mode: "count", events: ["connect_sent"] },
  connect_sent_30d: { mode: "count", events: ["connect_sent"] },
  connect_replied_24h: { mode: "count", events: ["connect_replied"] },
  connect_replied_7d: { mode: "count", events: ["connect_replied"] },
  connect_replied_30d: { mode: "count", events: ["connect_replied"] },
  messages_sent_24h: { mode: "count", events: ["message_sent"] },
  messages_sent_7d: { mode: "count", events: ["message_sent"] },
  messages_sent_30d: { mode: "count", events: ["message_sent"] },
  reports_count_24h: { mode: "count", events: ["report_created"] },
  reports_count_7d: { mode: "count", events: ["report_created"] },
  reports_count_30d: { mode: "count", events: ["report_created"] },
  ai_calls_24h: { mode: "count", events: ["ai_request"] },
  tg_verify_rate: { mode: "ratio", numerator: ["telegram_verified"], denominator: ["register_started"] },
  registration_completion_rate: { mode: "ratio", numerator: ["registration_completed"], denominator: ["register_started"] },
  reply_rate: { mode: "ratio", numerator: ["connect_replied"], denominator: ["connect_sent"] },
  join_rate: { mode: "ratio", numerator: ["event_joined"], denominator: ["event_viewed"] },
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function getCanonicals(metric: string) {
  const preset = METRIC_MAP[metric];
  if (preset?.events?.length) return preset.events;
  if (metric.startsWith("posts_duo")) return ["post_published_daily_duo"];
  if (metric.startsWith("posts_video")) return ["post_published_video"];
  if (metric.startsWith("event_viewed")) return ["event_viewed"];
  if (metric.startsWith("event_joined")) return ["event_joined"];
  if (metric.startsWith("connect_sent")) return ["connect_sent"];
  if (metric.startsWith("connect_replied")) return ["connect_replied"];
  if (metric.startsWith("messages_sent")) return ["message_sent"];
  if (metric.startsWith("reports_count")) return ["report_created"];
  if (metric.includes("ai_cost")) return ["ai_cost"];
  if (metric.startsWith("events_total") || metric.startsWith("active_users") || metric === "dau_proxy" || metric === "wau_proxy") return ["*"];
  return [];
}

function countForMode(rows: Array<{ canonical: string; user_id: string | null; properties: Record<string, unknown> | null }>, metric: string) {
  const preset = METRIC_MAP[metric];

  if (preset?.mode === "ratio") {
    const numeratorSet = new Set(preset.numerator ?? []);
    const denominatorSet = new Set(preset.denominator ?? []);
    const num = rows.reduce((acc, r) => acc + (numeratorSet.has(r.canonical) ? 1 : 0), 0);
    const den = rows.reduce((acc, r) => acc + (denominatorSet.has(r.canonical) ? 1 : 0), 0);
    return { value: den > 0 ? Number((num / den).toFixed(4)) : 0, numerator: num, denominator: den };
  }

  if (metric.includes("ai_cost")) {
    const sum = rows.reduce((acc, r) => {
      if (r.canonical !== "ai_cost") return acc;
      const usd = Number((r.properties?.usd as number | undefined) ?? 0);
      return Number.isFinite(usd) ? acc + usd : acc;
    }, 0);
    return { value: Number(sum.toFixed(4)) };
  }

  if (preset?.mode === "distinct" || metric.includes("active_users") || metric === "dau_proxy" || metric === "wau_proxy") {
    return { value: new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]).size };
  }

  const canonicals = getCanonicals(metric);
  if (canonicals.includes("*")) return { value: rows.length };
  if (!canonicals.length) return { value: 0 };

  const set = new Set(canonicals);
  return { value: rows.reduce((acc, r) => acc + (set.has(r.canonical) ? 1 : 0), 0) };
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst", "support"]);

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      metric: searchParams.get("metric") ?? "",
      days: searchParams.get("days") ?? 30,
      segment: searchParams.get("segment") ?? "all",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const now = Date.now();
    const toISO = new Date(now).toISOString();
    const fromISO = new Date(now - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
    const prevFromISO = new Date(now - parsed.data.days * 2 * 24 * 60 * 60 * 1000).toISOString();
    const prevToISO = fromISO;

    const window = parseWindow(fromISO, toISO, parsed.data.days);
    const prevWindow = parseWindow(prevFromISO, prevToISO, parsed.data.days);

    const [segmentUserIds, schema] = await Promise.all([
      getSegmentUserIds(parsed.data.segment, window.fromISO, window.toISO),
      getSchemaSnapshot(["analytics_events", "users"]),
    ]);

    const analyticsCols = asSet(schema, "analytics_events");
    const usersCols = asSet(schema, "users");
    if (!analyticsCols.has("event_name") || !analyticsCols.has("created_at")) {
      return ok({
        metric: parsed.data.metric,
        definition: DEFAULT_HELP_TEXTS[`metric.${parsed.data.metric}` as keyof typeof DEFAULT_HELP_TEXTS] ?? null,
        source: kpiSource(parsed.data.metric),
        period: { from: window.fromISO, to: window.toISO, days: parsed.data.days, segment: parsed.data.segment },
        current_value: 0,
        previous_value: 0,
        delta: 0,
        status: "No data",
        reasons: ["analytics_events не содержит нужных колонок"],
        top_event_names_24h: [],
        breakdown_by_day: [],
        breakdown_by_demo_group: [],
        breakdown_by_city: [],
        top_users: [],
        top_events: [],
      });
    }

    let currentQuery = supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id,created_at,properties")
      .gte("created_at", window.fromISO)
      .lte("created_at", window.toISO)
      .order("created_at", { ascending: true })
      .limit(200000);
    let prevQuery = supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id,created_at,properties")
      .gte("created_at", prevWindow.fromISO)
      .lte("created_at", prevWindow.toISO)
      .order("created_at", { ascending: true })
      .limit(200000);

    if (segmentUserIds && segmentUserIds.length) {
      currentQuery = currentQuery.in("user_id", segmentUserIds);
      prevQuery = prevQuery.in("user_id", segmentUserIds);
    }

    const [currentRes, prevRes] = await Promise.all([currentQuery, prevQuery]);
    if (currentRes.error) return fail(currentRes.error.message, 500);
    if (prevRes.error) return fail(prevRes.error.message, 500);

    const currentRows = ((currentRes.data ?? []) as EventRow[])
      .filter((r) => isActivityEventName(r.event_name))
      .map((r) => ({ ...r, canonical: canonicalizeEventName(r.event_name) }));
    const prevRows = ((prevRes.data ?? []) as EventRow[])
      .filter((r) => isActivityEventName(r.event_name))
      .map((r) => ({ ...r, canonical: canonicalizeEventName(r.event_name) }));

    const metricCanonicals = getCanonicals(parsed.data.metric);
    const isAllActivity = metricCanonicals.includes("*");
    const metricSet = new Set(metricCanonicals);

    const rowsForMetric = isAllActivity
      ? currentRows
      : currentRows.filter((r) => metricSet.has(r.canonical) || METRIC_MAP[parsed.data.metric]?.mode === "ratio");
    const prevRowsForMetric = isAllActivity
      ? prevRows
      : prevRows.filter((r) => metricSet.has(r.canonical) || METRIC_MAP[parsed.data.metric]?.mode === "ratio");

    const current = countForMode(rowsForMetric, parsed.data.metric);
    const previous = countForMode(prevRowsForMetric, parsed.data.metric);
    const currentValue = Number(current.value ?? 0);
    const previousValue = Number(previous.value ?? 0);
    const delta = previousValue > 0 ? Number(((currentValue - previousValue) / previousValue).toFixed(4)) : (currentValue > 0 ? 1 : 0);

    const topEventMap = new Map<string, number>();
    for (const row of currentRows.filter((x) => new Date(x.created_at).getTime() >= now - 24 * 60 * 60 * 1000)) {
      topEventMap.set(row.canonical, (topEventMap.get(row.canonical) ?? 0) + 1);
    }

    const dayMap = new Map<string, number>();
    const demoMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const userMap = new Map<string, number>();
    const eventMap = new Map<string, number>();

    const usersById = new Map<string, UserRow>();
    const userIds = [...new Set(rowsForMetric.map((r) => r.user_id).filter(Boolean) as string[])].slice(0, 5000);
    if (usersCols.has("id") && userIds.length) {
      const selectCols = ["id", "city", "is_demo", "demo_group", "created_at"].filter((c) => usersCols.has(c));
      if (!selectCols.includes("id")) selectCols.unshift("id");
      const usersRes = await supabaseAdmin.from("users").select(selectCols.join(",")).in("id", userIds);
      if (!usersRes.error) {
        for (const row of (usersRes.data ?? []) as UserRow[]) usersById.set(row.id, row);
      }
    }

    for (const row of rowsForMetric) {
      const d = dayKey(row.created_at);
      dayMap.set(d, (dayMap.get(d) ?? 0) + 1);

      const uid = row.user_id ?? "—";
      userMap.set(uid, (userMap.get(uid) ?? 0) + 1);

      const eventId = String((row.properties?.event_id as string | undefined) ?? "").trim();
      if (eventId) eventMap.set(eventId, (eventMap.get(eventId) ?? 0) + 1);

      const user = row.user_id ? usersById.get(row.user_id) : undefined;
      const demoGroup = String((row.properties?.demo_group as string | undefined) ?? user?.demo_group ?? (user?.is_demo ? "demo" : "real"));
      demoMap.set(demoGroup, (demoMap.get(demoGroup) ?? 0) + 1);

      const city = String((row.properties?.city as string | undefined) ?? user?.city ?? "—");
      cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    }

    const toSorted = (map: Map<string, number>, key: string, value: string, limit = 10) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([k, v]) => ({ [key]: k, [value]: v }));

    const status = rowsForMetric.length === 0 ? "No data" : currentValue > 0 ? "OK" : "Low";
    const reasons: string[] = [];

    if (rowsForMetric.length === 0) {
      if (!metricCanonicals.length && !METRIC_MAP[parsed.data.metric]) {
        reasons.push("Для метрики нет маппинга событий. Добавьте ключ в drilldown mapping.");
      }
      reasons.push("За выбранный период не найдено событий нужной категории.");
      if (!currentRows.length) reasons.push("В analytics_events нет activity событий за период.");
    }

    return ok({
      metric: parsed.data.metric,
      definition: DEFAULT_HELP_TEXTS[`metric.${parsed.data.metric}` as keyof typeof DEFAULT_HELP_TEXTS] ?? null,
      source: kpiSource(parsed.data.metric),
      period: { from: window.fromISO, to: window.toISO, days: parsed.data.days, segment: parsed.data.segment },
      current_value: currentValue,
      previous_value: previousValue,
      delta,
      status,
      reasons,
      top_event_names_24h: toSorted(topEventMap, "event_name", "count", 5),
      breakdown_by_day: toSorted(dayMap, "day", "value", 31),
      breakdown_by_demo_group: toSorted(demoMap, "demo_group", "value", 10),
      breakdown_by_city: toSorted(cityMap, "city", "value", 20),
      top_users: toSorted(userMap, "user_id", "value", 12),
      top_events: toSorted(eventMap, "event_id", "value", 12),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to build metric drilldown", 500);
  }
}
