import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { DEFAULT_HELP_TEXTS, kpiSource } from "@/lib/admin-help-texts";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { isActivityEventName } from "@/server/event-dictionary";
import { supabaseAdmin } from "@/supabase/admin";

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
};

type MetricFamily = "auth" | "profile" | "feed" | "events" | "social" | "safety" | "ai" | "admin";

type MetricConfig = {
  family: MetricFamily;
  mode: "count" | "distinct" | "ratio";
  variants: string[];
  numerator?: string[];
  denominator?: string[];
};

type DictionaryRow = {
  event_name: string;
  family: string;
  aliases: string[] | null;
  metric_tags: string[] | null;
};

const querySchema = z.object({
  metric: z.string().min(1),
  days: z.coerce.number().int().min(1).max(180).default(30),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
  async: z.coerce.boolean().optional().default(false),
  job_id: z.string().uuid().optional(),
});

const autoMapSchema = z.object({
  metric: z.string().min(1),
  days: z.coerce.number().int().min(1).max(180).default(30),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
});

type DrilldownCacheEntry = { cachedAt: number; expiresAt: number; payload: any };
type DrilldownJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  cacheKey: string;
  createdAt: number;
  updatedAt: number;
  payload?: any;
  error?: string;
};

const DRILLDOWN_CACHE_TTL_MS = 120_000;
const DRILLDOWN_STALE_MS = 15 * 60_000;
const DRILLDOWN_CONCURRENCY_LIMIT = 2;
const DRILLDOWN_SYNC_TIMEOUT_MS = 2_500;
const DRILLDOWN_ASYNC_THRESHOLD_DAYS = 90;

const drilldownCache = new Map<string, DrilldownCacheEntry>();
const drilldownJobs = new Map<string, DrilldownJob>();
const drilldownJobsByCacheKey = new Map<string, string>();
let drilldownInFlight = 0;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DRILLDOWN_TIMEOUT")), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function uniq(values: string[]) {
  return [...new Set(values.map((x) => x.trim()).filter(Boolean))];
}

function normalizeEventName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function findExtremum(points: Array<{ ts: string; value: number }>, kind: "max" | "min") {
  if (!points.length) return null;
  let best = points[0];
  for (const point of points) {
    if (kind === "max" ? point.value > best.value : point.value < best.value) best = point;
  }
  return best;
}

function metricKeyword(metric: string) {
  const m = metric.toLowerCase();
  if (m.includes("connect") || m.includes("reply") || m.includes("message")) return "connect";
  if (m.includes("post") || m.includes("duo") || m.includes("video") || m.includes("comment")) return "post";
  if (m.includes("event") || m.includes("join")) return "event";
  if (m.includes("report") || m.includes("safety")) return "report";
  if (m.includes("verify") || m.includes("registration") || m.includes("auth")) return "auth";
  if (m.includes("ai")) return "ai";
  return "";
}

function resolveMetricConfig(metric: string): MetricConfig {
  const m = metric.toLowerCase();

  if (m === "reply_rate" || m.includes("connect_replied")) {
    return {
      family: "social",
      mode: m === "reply_rate" ? "ratio" : "count",
      variants: ["connect_replied", "chat.connect_replied"],
      numerator: ["connect_replied", "chat.connect_replied"],
      denominator: ["connect_sent", "chat.connect_sent"],
    };
  }

  if (m.includes("connect_sent")) {
    return {
      family: "social",
      mode: "count",
      variants: ["connect_sent", "chat.connect_sent"],
    };
  }

  if (m.includes("message") || m.includes("wmc") || m.includes("continued")) {
    return {
      family: "social",
      mode: "count",
      variants: ["message_sent", "chat.message_sent", "chat_message_sent"],
    };
  }

  if (m.includes("posts_duo")) {
    return {
      family: "feed",
      mode: "count",
      variants: ["post_published_daily_duo", "feed.post_published_daily_duo"],
    };
  }

  if (m.includes("posts_video")) {
    return {
      family: "feed",
      mode: "count",
      variants: ["post_published_video", "feed.post_published_video"],
    };
  }

  if (m === "posts" || m.includes("posters") || m.includes("posts_per") || m.includes("content")) {
    return {
      family: "feed",
      mode: "count",
      variants: [
        "post_published_daily_duo",
        "feed.post_published_daily_duo",
        "post_published_video",
        "feed.post_published_video",
      ],
    };
  }

  if (m.includes("comment")) {
    return {
      family: "feed",
      mode: "count",
      variants: ["comment_created", "comment.created"],
    };
  }

  if (m === "join_rate") {
    return {
      family: "events",
      mode: "ratio",
      variants: ["event_joined", "events.joined", "event_viewed", "events.viewed"],
      numerator: ["event_joined", "events.joined"],
      denominator: ["event_viewed", "events.viewed"],
    };
  }

  if (m.includes("event_join") || m.includes("joined")) {
    return {
      family: "events",
      mode: "count",
      variants: ["event_joined", "events.joined"],
    };
  }

  if (m.includes("event_view") || m.includes("events.viewed")) {
    return {
      family: "events",
      mode: "count",
      variants: ["event_viewed", "events.viewed"],
    };
  }

  if (m.includes("report") || m.includes("risk") || m.includes("safety")) {
    return {
      family: "safety",
      mode: "count",
      variants: ["report_created", "safety.report_created", "ai_flagged_content"],
    };
  }

  if (m.includes("tg_verify") || m === "registration_completion_rate") {
    if (m.includes("tg_verify")) {
      return {
        family: "auth",
        mode: "ratio",
        variants: ["auth.telegram_verified", "telegram_verified", "auth.register_started", "register_started"],
        numerator: ["auth.telegram_verified", "telegram_verified"],
        denominator: ["auth.register_started", "register_started"],
      };
    }

    return {
      family: "auth",
      mode: "ratio",
      variants: [
        "auth.registration_completed",
        "registration_completed",
        "auth.register_started",
        "register_started",
      ],
      numerator: ["auth.registration_completed", "registration_completed"],
      denominator: ["auth.register_started", "register_started"],
    };
  }

  if (m.includes("profile_completed") || m.includes("activation")) {
    return {
      family: "profile",
      mode: "count",
      variants: ["profile_completed", "profile.completed"],
    };
  }

  if (m.includes("ai_cost")) {
    return {
      family: "ai",
      mode: "count",
      variants: ["ai_cost", "ai.request_cost"],
    };
  }

  if (m.includes("ai_calls") || m.includes("ai_requests")) {
    return {
      family: "ai",
      mode: "count",
      variants: ["ai_request", "ai.request", "ai_call"],
    };
  }

  if (m.includes("dau") || m.includes("wau") || m.includes("active_users") || m.includes("events_total") || m.includes("session")) {
    return {
      family: "admin",
      mode: "distinct",
      variants: ["*"],
    };
  }

  return {
    family: "admin",
    mode: "count",
    variants: ["*"],
  };
}

async function getDynamicAliasesForFamily(family: MetricFamily, metric: string) {
  const schema = await getSchemaSnapshot(["event_dictionary"]);
  const cols = asSet(schema, "event_dictionary");
  if (!cols.has("event_name") || !cols.has("family")) return [] as string[];

  const q = await supabaseAdmin
    .from("event_dictionary")
    .select("event_name,family,aliases,metric_tags")
    .eq("family", family)
    .limit(400);

  if (q.error) return [] as string[];

  const metricTag = `auto:${metric}`;
  const rows = (q.data ?? []) as DictionaryRow[];
  const aliases: string[] = [];

  for (const row of rows) {
    const tags = Array.isArray(row.metric_tags) ? row.metric_tags : [];
    if (row.family !== family && !tags.includes(metricTag)) continue;
    aliases.push(row.event_name);
    if (Array.isArray(row.aliases)) aliases.push(...row.aliases);
  }

  return uniq(aliases);
}

function buildTopEventNames(rows: EventRow[], limit = 10) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.event_name, (map.get(row.event_name) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([event_name, count]) => ({ event_name, count }));
}

function buildNoDataReasons(metric: string, expected: string[], topPeriod: Array<{ event_name: string; count: number }>) {
  const reasons: string[] = [];
  reasons.push("За выбранный период нет событий, подходящих под текущую метрику.");

  if (!expected.length) {
    reasons.push("Для метрики не найден mapping событий.");
    return reasons;
  }

  reasons.push(`Ищем event_name: ${expected.join(", ")}.`);

  const expectedNorm = new Set(expected.map(normalizeEventName));
  const keyword = metricKeyword(metric);
  const mismatches: string[] = [];

  for (const row of topPeriod) {
    const raw = row.event_name;
    const norm = normalizeEventName(raw);
    const keywordMatch = keyword ? norm.includes(keyword) : false;
    if (expectedNorm.has(norm)) continue;
    if (!keywordMatch && mismatches.length > 0) continue;
    mismatches.push(raw);
    if (mismatches.length >= 3) break;
  }

  if (mismatches.length) {
    for (const value of mismatches) {
      reasons.push(`Mismatch: в базе есть ${value}, но метрика считает ${expected[0]}.`);
    }
  }

  return reasons;
}

function toSorted<T extends string>(map: Map<string, number>, key: T, valueKey: string, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => ({ [key]: k, [valueKey]: v }));
}

async function loadEvents(windowFrom: string, windowTo: string, segmentUserIds: string[] | null) {
  let q = supabaseAdmin
    .from("analytics_events")
    .select("event_name,user_id,created_at,properties")
    .gte("created_at", windowFrom)
    .lte("created_at", windowTo)
    .order("created_at", { ascending: true })
    .limit(200000);

  if (segmentUserIds && segmentUserIds.length) {
    q = q.in("user_id", segmentUserIds);
  }

  const res = await q;
  if (res.error) throw new Error(res.error.message);

  return ((res.data ?? []) as EventRow[]).filter((r) => isActivityEventName(r.event_name));
}

async function loadMetricEvents(windowFrom: string, windowTo: string, segmentUserIds: string[] | null, variants: string[]) {
  let q = supabaseAdmin
    .from("analytics_events")
    .select("event_name,user_id,created_at,properties")
    .gte("created_at", windowFrom)
    .lte("created_at", windowTo)
    .order("created_at", { ascending: true })
    .limit(200000);

  if (segmentUserIds && segmentUserIds.length) {
    q = q.in("user_id", segmentUserIds);
  }

  if (!variants.includes("*") && variants.length) {
    q = q.in("event_name", variants);
  }

  const res = await q;
  if (res.error) throw new Error(res.error.message);

  return ((res.data ?? []) as EventRow[]).filter((r) => isActivityEventName(r.event_name));
}

function countMetricValue(rows: EventRow[], config: MetricConfig) {
  if (config.mode === "distinct") {
    return new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]).size;
  }

  if (config.mode === "ratio") {
    const num = new Set(config.numerator ?? []);
    const den = new Set(config.denominator ?? []);
    const numerator = rows.reduce((acc, r) => acc + (num.has(r.event_name) ? 1 : 0), 0);
    const denominator = rows.reduce((acc, r) => acc + (den.has(r.event_name) ? 1 : 0), 0);
    if (denominator <= 0) return 0;
    return Number((numerator / denominator).toFixed(4));
  }

  return rows.length;
}

async function loadUsersById(userIds: string[]) {
  if (!userIds.length) return new Map<string, UserRow>();

  const schema = await getSchemaSnapshot(["users"]);
  const usersCols = asSet(schema, "users");
  const selectCols = ["id", "city", "is_demo", "demo_group"].filter((col) => usersCols.has(col));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  const usersRes = await supabaseAdmin.from("users").select(selectCols.join(",")).in("id", userIds.slice(0, 5000));
  if (usersRes.error) return new Map<string, UserRow>();

  const map = new Map<string, UserRow>();
  for (const row of (usersRes.data ?? []) as UserRow[]) {
    map.set(row.id, row);
  }

  return map;
}

function buildMetricBreakdowns(rows: EventRow[], usersById: Map<string, UserRow>) {
  const byDay = new Map<string, number>();
  const byHour = new Map<string, number>();
  const byWeek = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byDemoGroup = new Map<string, number>();
  const byCity = new Map<string, number>();
  const byUser = new Map<string, number>();
  const byEventId = new Map<string, number>();

  for (const row of rows) {
    const dKey = dayKey(row.created_at);
    const hKey = row.created_at.slice(0, 13) + ":00";
    const wKey = weekKey(row.created_at);
    const mKey = monthKey(row.created_at);

    byDay.set(dKey, (byDay.get(dKey) ?? 0) + 1);
    byHour.set(hKey, (byHour.get(hKey) ?? 0) + 1);
    byWeek.set(wKey, (byWeek.get(wKey) ?? 0) + 1);
    byMonth.set(mKey, (byMonth.get(mKey) ?? 0) + 1);

    const userId = row.user_id ?? "—";
    byUser.set(userId, (byUser.get(userId) ?? 0) + 1);

    const user = row.user_id ? usersById.get(row.user_id) : undefined;
    const demoGroup = String((row.properties?.demo_group as string | undefined) ?? user?.demo_group ?? (user?.is_demo ? "demo" : "real"));
    byDemoGroup.set(demoGroup, (byDemoGroup.get(demoGroup) ?? 0) + 1);

    const city = String((row.properties?.city as string | undefined) ?? user?.city ?? "—");
    byCity.set(city, (byCity.get(city) ?? 0) + 1);

    const eventId = String((row.properties?.event_id as string | undefined) ?? "").trim();
    if (eventId) byEventId.set(eventId, (byEventId.get(eventId) ?? 0) + 1);
  }

  const dayRows = toSorted(byDay, "day", "value", 31) as Array<{ day: string; value: number }>;
  const hourRows = toSorted(byHour, "hour", "value", 72) as Array<{ hour: string; value: number }>;
  const weekRows = toSorted(byWeek, "week_start", "value", 26) as Array<{ week_start: string; value: number }>;
  const monthRows = toSorted(byMonth, "month", "value", 24) as Array<{ month: string; value: number }>;

  const daySeries = dayRows.map((x) => ({ ts: x.day, value: Number(x.value) }));
  const weekSeries = weekRows.map((x) => ({ ts: x.week_start, value: Number(x.value) }));
  const monthSeries = monthRows.map((x) => ({ ts: x.month, value: Number(x.value) }));

  return {
    breakdown_by_day: dayRows,
    breakdown_by_hour: hourRows,
    breakdown_by_week: weekRows,
    breakdown_by_month: monthRows,
    best_day: findExtremum(daySeries, "max"),
    worst_day: findExtremum(daySeries, "min"),
    best_week: findExtremum(weekSeries, "max"),
    worst_week: findExtremum(weekSeries, "min"),
    best_month: findExtremum(monthSeries, "max"),
    worst_month: findExtremum(monthSeries, "min"),
    breakdown_by_demo_group: toSorted(byDemoGroup, "demo_group", "value", 10),
    breakdown_by_city: toSorted(byCity, "city", "value", 20),
    top_users: toSorted(byUser, "user_id", "value", 20),
    top_events: toSorted(byEventId, "event_id", "value", 20),
  };
}

async function buildDrilldownPayload(input: z.infer<typeof querySchema>) {
  const now = Date.now();
  const toISO = input.to ?? new Date(now).toISOString();
  const fromISO = input.from ?? new Date(new Date(toISO).getTime() - input.days * 24 * 60 * 60 * 1000).toISOString();

  const currentWindow = parseWindow(fromISO, toISO, input.days);
  const periodMs = Math.max(1, currentWindow.to.getTime() - currentWindow.from.getTime());
  const prevToISO = new Date(currentWindow.from.getTime()).toISOString();
  const prevFromISO = new Date(currentWindow.from.getTime() - periodMs).toISOString();
  const previousWindow = parseWindow(prevFromISO, prevToISO, input.days);

  const segmentUserIds = await getSegmentUserIds(input.segment, currentWindow.fromISO, currentWindow.toISO);

  const config = resolveMetricConfig(input.metric);
  const dynamicAliases = await getDynamicAliasesForFamily(config.family, input.metric);
  const expectedVariants = config.variants.includes("*") ? uniq(dynamicAliases) : uniq([...config.variants, ...dynamicAliases]);

  const [currentRowsForMetric, prevRowsForMetric, currentRowsSegmented] = await Promise.all([
    loadMetricEvents(currentWindow.fromISO, currentWindow.toISO, segmentUserIds, expectedVariants),
    loadMetricEvents(previousWindow.fromISO, previousWindow.toISO, segmentUserIds, expectedVariants),
    loadEvents(currentWindow.fromISO, currentWindow.toISO, segmentUserIds),
  ]);

  const currentValue = countMetricValue(currentRowsForMetric, config);
  const previousValue = countMetricValue(prevRowsForMetric, config);
  const delta =
    previousValue > 0
      ? Number((((currentValue as number) - (previousValue as number)) / (previousValue as number)).toFixed(4))
      : (currentValue as number) > 0
        ? 1
        : 0;

  const totalCount = currentRowsForMetric.length;
  const uniqueUsers = new Set(currentRowsForMetric.map((r) => r.user_id).filter(Boolean) as string[]).size;

  const usersById = await loadUsersById([...new Set(currentRowsForMetric.map((r) => r.user_id).filter(Boolean) as string[])]);
  const breakdowns = buildMetricBreakdowns(currentRowsForMetric, usersById);

  const topEventNamesPeriod = buildTopEventNames(currentRowsSegmented, 10);
  const topEventNames24h = buildTopEventNames(
    currentRowsSegmented.filter((row) => new Date(row.created_at).getTime() >= now - 24 * 60 * 60 * 1000),
    10,
  );

  const noDataReasons = totalCount === 0 ? buildNoDataReasons(input.metric, expectedVariants, topEventNamesPeriod) : [];

  return {
    metric: input.metric,
    definition: DEFAULT_HELP_TEXTS[`metric.${input.metric}` as keyof typeof DEFAULT_HELP_TEXTS] ?? null,
    source: kpiSource(input.metric),
    period: {
      from: currentWindow.fromISO,
      to: currentWindow.toISO,
      days: input.days,
      segment: input.segment,
    },
    current_value: Number(currentValue ?? 0),
    previous_value: Number(previousValue ?? 0),
    delta,
    status: totalCount === 0 ? "No data" : Number(currentValue ?? 0) > 0 ? "OK" : "Low",
    total_count: totalCount,
    unique_users: uniqueUsers,
    expected_event_names: expectedVariants,
    reasons: noDataReasons,
    top_event_names_period: topEventNamesPeriod,
    top_event_names_24h: topEventNames24h,
    generated_at: new Date().toISOString(),
    ...breakdowns,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst", "support"]);

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      metric: searchParams.get("metric") ?? "",
      days: searchParams.get("days") ?? 30,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
      async: ["1", "true", "yes", "on"].includes(String(searchParams.get("async") ?? "").toLowerCase()),
      job_id: searchParams.get("job_id") ?? undefined,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    if (parsed.data.job_id) {
      const job = drilldownJobs.get(parsed.data.job_id);
      if (!job) {
        return fail("Job not found", 404, { code: "DB", hint: "Проверь job_id и перезапусти запрос" });
      }

      if (job.status === "failed") {
        return fail(job.error ?? "Drilldown job failed", 500, {
          code: "DB",
          hint: "Перезапусти drilldown или уменьши период",
        });
      }

      if (job.status === "done" && job.payload) {
        return ok({ ok: true, async: true, status: job.status, job_id: job.id, payload: job.payload });
      }

      return ok({ ok: true, async: true, status: job.status, job_id: job.id });
    }

    const toISO = parsed.data.to ?? new Date().toISOString();
    const fromISO = parsed.data.from ?? new Date(new Date(toISO).getTime() - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
    const cacheKey = [parsed.data.metric, parsed.data.days, parsed.data.segment, fromISO.slice(0, 16), toISO.slice(0, 16)].join(":");

    const cached = drilldownCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ok({
        ...cached.payload,
        cache: { mode: "hot", cached_at: new Date(cached.cachedAt).toISOString() },
      });
    }

    const staleCached = cached && Date.now() - cached.cachedAt <= DRILLDOWN_STALE_MS ? cached : null;

    if (parsed.data.async || parsed.data.days > DRILLDOWN_ASYNC_THRESHOLD_DAYS) {
      const existingJobId = drilldownJobsByCacheKey.get(cacheKey);
      if (existingJobId) {
        const existing = drilldownJobs.get(existingJobId);
        if (existing) {
          return ok({ ok: true, async: true, status: existing.status, job_id: existing.id });
        }
      }

      const jobId = crypto.randomUUID();
      const job: DrilldownJob = {
        id: jobId,
        status: "queued",
        cacheKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      drilldownJobs.set(jobId, job);
      drilldownJobsByCacheKey.set(cacheKey, jobId);

      void (async () => {
        try {
          job.status = "running";
          job.updatedAt = Date.now();
          const payload = await buildDrilldownPayload(parsed.data);
          job.status = "done";
          job.payload = payload;
          job.updatedAt = Date.now();
          drilldownCache.set(cacheKey, {
            cachedAt: Date.now(),
            expiresAt: Date.now() + DRILLDOWN_CACHE_TTL_MS,
            payload,
          });
        } catch (error) {
          job.status = "failed";
          job.error = error instanceof Error ? error.message : "Failed to compute drilldown";
          job.updatedAt = Date.now();
        }
      })();

      return ok({ ok: true, async: true, status: "queued", job_id: jobId });
    }

    if (drilldownInFlight >= DRILLDOWN_CONCURRENCY_LIMIT) {
      if (staleCached) {
        return ok({
          ...staleCached.payload,
          warnings: [...(staleCached.payload?.warnings ?? []), "drilldown fallback: stale cache used"],
          cache: { mode: "stale", cached_at: new Date(staleCached.cachedAt).toISOString() },
        });
      }

      return fail("Сервер метрик перегружен. Попробуй через пару секунд.", 503, {
        code: "TIMEOUT",
        hint: "Используй async=1 для длинных периодов или сократи окно анализа",
      });
    }

    drilldownInFlight += 1;

    try {
      const payload = await withTimeout(buildDrilldownPayload(parsed.data), DRILLDOWN_SYNC_TIMEOUT_MS);
      drilldownCache.set(cacheKey, {
        cachedAt: Date.now(),
        expiresAt: Date.now() + DRILLDOWN_CACHE_TTL_MS,
        payload,
      });

      return ok({
        ...payload,
        cache: { mode: "fresh", cached_at: new Date().toISOString() },
      });
    } catch (error) {
      if (staleCached) {
        return ok({
          ...staleCached.payload,
          warnings: [...(staleCached.payload?.warnings ?? []), "drilldown fallback: stale cache used"],
          cache: { mode: "stale", cached_at: new Date(staleCached.cachedAt).toISOString() },
        });
      }

      if (error instanceof Error && error.message === "DRILLDOWN_TIMEOUT") {
        return fail("Drilldown запрос превысил лимит времени", 504, {
          code: "TIMEOUT",
          hint: "Сократи период или запусти async режим (?async=1)",
        });
      }

      return fail(error instanceof Error ? error.message : "Failed to build metric drilldown", 500, {
        code: "DB",
      });
    } finally {
      drilldownInFlight = Math.max(0, drilldownInFlight - 1);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to build metric drilldown", 500);
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = autoMapSchema.safeParse(body);

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const now = Date.now();
    const toISO = parsed.data.to ?? new Date(now).toISOString();
    const fromISO =
      parsed.data.from ?? new Date(new Date(toISO).getTime() - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
    const window = parseWindow(fromISO, toISO, parsed.data.days);

    const segmentUserIds = await getSegmentUserIds(parsed.data.segment, window.fromISO, window.toISO);
    const rows = await loadEvents(window.fromISO, window.toISO, segmentUserIds);

    const config = resolveMetricConfig(parsed.data.metric);
    const dynamicAliases = await getDynamicAliasesForFamily(config.family, parsed.data.metric);
    const expectedVariants = uniq(config.variants.includes("*") ? dynamicAliases : [...config.variants, ...dynamicAliases]);

    const expectedNorm = new Set(expectedVariants.map(normalizeEventName));
    const topEvents = buildTopEventNames(rows, 10);
    const keyword = metricKeyword(parsed.data.metric);

    const candidates = topEvents
      .map((x) => x.event_name)
      .filter((eventName) => {
        if (!isActivityEventName(eventName)) return false;
        if (expectedNorm.has(normalizeEventName(eventName))) return false;
        if (!keyword) return true;
        return normalizeEventName(eventName).includes(keyword);
      })
      .slice(0, 10);

    if (!candidates.length) {
      return ok({ ok: true, mapped_count: 0, mapped: [], hint: "Нет подходящих event_name для auto-map" });
    }

    const payload = candidates.map((eventName) => ({
      event_name: eventName,
      family: config.family,
      display_ru: `Auto-map: ${eventName}`,
      metric_tags: ["auto", `auto:${parsed.data.metric}`],
      is_key: false,
      aliases: [eventName],
      updated_at: new Date().toISOString(),
    }));

    const ins = await supabaseAdmin.from("event_dictionary").upsert(payload, { onConflict: "event_name" });
    if (ins.error) {
      return fail(ins.error.message, 500, {
        code: "DB",
        hint: "Проверь таблицу event_dictionary и ее колонки",
      });
    }

    await logAdminAction({
      adminId,
      action: "drilldown_auto_map",
      targetType: "event_dictionary",
      targetId: parsed.data.metric,
      meta: {
        metric: parsed.data.metric,
        mapped: candidates,
        days: parsed.data.days,
        from: window.fromISO,
        to: window.toISO,
        segment: parsed.data.segment,
      },
    });

    return ok({ ok: true, mapped_count: candidates.length, mapped: candidates });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to auto-map event names", 500);
  }
}
