import { createClient } from "@supabase/supabase-js";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus } from "@/server/simulation";
import { supabaseAdmin } from "@/supabase/admin";
import { computeSeries } from "@/server/metrics-series";
import { canonicalizeEventName, knownEventNames } from "@/server/event-dictionary";
import { parseWindow } from "@/server/admin-metrics";

type TableRow = {
  name: string;
  exists: boolean;
  rows_24h: number;
  rows_7d: number;
  rows_30d: number;
};

type RlsRow = {
  table: string;
  can_select: boolean;
  note: string;
};

const TABLES: Array<{ name: string; dateColumn: string }> = [
  { name: "users", dateColumn: "created_at" },
  { name: "events", dateColumn: "created_at" },
  { name: "analytics_events", dateColumn: "created_at" },
  { name: "reports", dateColumn: "created_at" },
  { name: "content_flags", dateColumn: "created_at" },
  { name: "feature_flags", dateColumn: "updated_at" },
  { name: "experiments", dateColumn: "updated_at" },
  { name: "alerts", dateColumn: "updated_at" },
  { name: "moderation_actions", dateColumn: "created_at" },
  { name: "admin_audit_log", dateColumn: "created_at" },
  { name: "simulation_runs", dateColumn: "created_at" },
  { name: "simulation_users", dateColumn: "created_at" },
  { name: "risk_signals", dateColumn: "created_at" },
  { name: "event_dictionary", dateColumn: "event_name" },
  { name: "user_stats_daily", dateColumn: "created_at" },
  { name: "system_settings", dateColumn: "updated_at" },
];

function boolEnv(name: string) {
  return Boolean(process.env[name] && process.env[name]?.length);
}

function shortError(msg?: string) {
  if (!msg) return "unknown";
  return msg.length > 200 ? `${msg.slice(0, 197)}...` : msg;
}

async function tableWindowCount(table: string, dateColumn: string, sinceISO: string) {
  const probe = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).limit(1);
  if (probe.error) return { exists: false, count: 0 };

  if (dateColumn === "event_name") return { exists: true, count: probe.count ?? 0 };

  const scoped = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte(dateColumn, sinceISO)
    .limit(1);

  if (scoped.error) {
    const total = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).limit(1);
    return { exists: !total.error, count: total.count ?? 0 };
  }

  return { exists: true, count: scoped.count ?? 0 };
}

async function checkRls(table: string): Promise<RlsRow> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { table, can_select: false, note: "No anon client env" };
  }

  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const probe = await anonClient.from(table).select("id", { count: "exact", head: true }).limit(1);
  if (probe.error) {
    return { table, can_select: false, note: shortError(probe.error.message) };
  }

  return { table, can_select: true, note: "ok" };
}

export async function GET() {
  try {
    await requireAdminUserId();

    const now = Date.now();
    const d24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const env = {
      SUPABASE_URL: boolEnv("NEXT_PUBLIC_SUPABASE_URL"),
      SUPABASE_ANON_KEY: boolEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE: boolEnv("SUPABASE_SERVICE_ROLE_KEY"),
      OPENAI_API_KEY: boolEnv("OPENAI_API_KEY"),
      ADMIN_DEVTOOLS_ENABLED: process.env.ADMIN_DEVTOOLS_ENABLED === "true" || process.env.NODE_ENV !== "production",
    };

    const [supabaseProbe, lastEvent, tableRows, rlsRows, topEvents24h, devtools, seriesProbe] = await Promise.all([
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).limit(1),
      supabaseAdmin.from("analytics_events").select("created_at").order("created_at", { ascending: false }).limit(1),
      Promise.all(
        TABLES.map(async (table) => {
          const [a, b, c] = await Promise.all([
            tableWindowCount(table.name, table.dateColumn, d24),
            tableWindowCount(table.name, table.dateColumn, d7),
            tableWindowCount(table.name, table.dateColumn, d30),
          ]);

          return {
            name: table.name,
            exists: a.exists || b.exists || c.exists,
            rows_24h: a.count,
            rows_7d: b.count,
            rows_30d: c.count,
          } as TableRow;
        }),
      ),
      Promise.all(["analytics_events", "reports", "feature_flags", "alerts", "event_dictionary"].map((t) => checkRls(t))),
      supabaseAdmin
        .from("analytics_events")
        .select("event_name")
        .gte("created_at", d24)
        .limit(120000),
      getDevtoolsStatus(),
      (() => {
        const window = parseWindow(d7, new Date().toISOString(), 7);
        return computeSeries({ metric: "dau", fromISO: window.fromISO, toISO: window.toISO, userIds: null });
      })(),
    ]);

    const supabase_ok = !supabaseProbe.error;

    const eventMap = new Map<string, number>();
    for (const row of topEvents24h.data ?? []) {
      const canonical = canonicalizeEventName(row.event_name);
      eventMap.set(canonical, (eventMap.get(canonical) ?? 0) + 1);
    }
    const top_event_names = [...eventMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event_name, count_24h]) => ({ event_name, count_24h }));

    const event_counts_24h = {
      total: [...eventMap.values()].reduce((a, b) => a + b, 0),
      register_started: eventMap.get("register_started") ?? 0,
      telegram_verified: eventMap.get("telegram_verified") ?? 0,
      registration_completed: eventMap.get("registration_completed") ?? 0,
      profile_completed: eventMap.get("profile_completed") ?? 0,
      posts_duo: eventMap.get("post_published_daily_duo") ?? 0,
      posts_video: eventMap.get("post_published_video") ?? 0,
      event_joined: eventMap.get("event_joined") ?? 0,
      connect_sent: eventMap.get("connect_sent") ?? 0,
      connect_replied: eventMap.get("connect_replied") ?? 0,
      chat_message_sent: eventMap.get("chat_message_sent") ?? 0,
      ai_error: eventMap.get("ai_error") ?? 0,
    };

    const openai = {
      enabled: env.OPENAI_API_KEY,
      reason: env.OPENAI_API_KEY ? "OPENAI_API_KEY found" : "OPENAI_API_KEY missing",
      fix_steps: env.OPENAI_API_KEY
        ? []
        : [
            "Добавь OPENAI_API_KEY в Vercel Project Settings -> Environment Variables",
            "Сделай redeploy проекта",
          ],
    };

    const canReadAnalytics = rlsRows.find((x) => x.table === "analytics_events")?.can_select ?? false;
    const rlsIssues = rlsRows.filter((x) => !x.can_select).map((x) => `${x.table}: ${x.note}`);

    const issues: string[] = [];
    const fixes: string[] = [];
    const recommended_fixes: Array<{ key: string; title: string; why: string; action_endpoint?: string }> = [];

    if (!supabase_ok) {
      issues.push(`Supabase connection failed: ${shortError(supabaseProbe.error?.message)}`);
      fixes.push("Проверь NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
    }

    for (const [key, value] of Object.entries(env)) {
      if (!value) issues.push(`ENV missing/disabled: ${key}`);
    }

    const missingTables = tableRows.filter((x) => !x.exists).map((x) => x.name);
    if (missingTables.length) {
      issues.push(`Missing tables: ${missingTables.join(", ")}`);
      fixes.push("Примени SQL миграции до последней версии.");
      recommended_fixes.push({
        key: "create_missing_tables",
        title: "Create missing tables",
        why: "Некоторые таблицы отсутствуют",
        action_endpoint: "/api/admin/fix-common",
      });
    }

    const analyticsTable = tableRows.find((x) => x.name === "analytics_events");
    const events24h = analyticsTable?.rows_24h ?? 0;

    if (events24h === 0) {
      issues.push("0 events in analytics_events for 24h");
      fixes.push("Нажми Start Live 40 Users или Seed Minimal.");
      recommended_fixes.push({ key: "seed_minimal", title: "Seed minimal", why: "Нет событий за 24ч", action_endpoint: "/api/admin/fix-common" });
      recommended_fixes.push({ key: "start_live_40", title: "Start Live 40 Users", why: "Нужен поток событий для графиков", action_endpoint: "/api/admin/fix-common" });
    }

    const known = new Set(knownEventNames());
    const unknownTop = top_event_names.filter((x) => !known.has(x.event_name));
    if (top_event_names.length > 0 && unknownTop.length === top_event_names.length) {
      issues.push("Event names mismatch: top events do not match metric dictionary");
      fixes.push("Установи event_dictionary mapping (auto-fix available).");
      recommended_fixes.push({
        key: "install_event_dictionary",
        title: "Install event dictionary mapping",
        why: "Имена событий не совпадают со словарём метрик",
        action_endpoint: "/api/admin/fix-common",
      });
    }

    if (!canReadAnalytics) {
      issues.push("RLS/permissions: cannot read analytics_events via anon");
      fixes.push("Проверь RLS policies или читай только через server routes.");
    }

    if (!devtools.enabled) {
      fixes.push(...devtools.fixSteps);
      recommended_fixes.push({
        key: "enable_devtools_safe_mode",
        title: "Enable DevTools in production (safe)",
        why: devtools.reason,
        action_endpoint: "/api/admin/fix-common",
      });
    }

    if (!env.OPENAI_API_KEY) {
      recommended_fixes.push({
        key: "openai_missing",
        title: "OpenAI key missing",
        why: "AI ассистент не сможет отвечать",
      });
    }

    const metricsEndpoints = {
      series_ok: Array.isArray(seriesProbe.points),
      sample_points_count: seriesProbe.points.length,
      errors: Array.isArray(seriesProbe.points) ? undefined : "Series format mismatch",
    };

    if (metricsEndpoints.sample_points_count === 0 && events24h > 0) {
      issues.push("metrics/series returns empty points while events exist");
      fixes.push("Проверь диапазон дат/таймзону и mapping event names.");
      recommended_fixes.push({ key: "write_test_event", title: "Write test event", why: "Проверка pipeline и графика", action_endpoint: "/api/admin/fix-common" });
    }

    recommended_fixes.push({ key: "recompute_aggregates", title: "Recompute aggregates", why: "Пересчитать user_stats_daily", action_endpoint: "/api/admin/fix-common" });

    return ok({
      env,
      env_present: env,
      supabase_ok,
      tables: tableRows,
      rls: {
        ok: rlsIssues.length === 0,
        issues: rlsIssues,
        details: rlsRows,
      },
      last_event_at: lastEvent.data?.[0]?.created_at ?? null,
      event_counts_24h,
      top_event_names,
      metrics_endpoints: metricsEndpoints,
      devtools: {
        enabled: devtools.enabled,
        reason: devtools.reason,
        fix_steps: devtools.fixSteps,
      },
      can_read_analytics: canReadAnalytics,
      openai,
      issues,
      fixes,
      recommended_fixes,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
