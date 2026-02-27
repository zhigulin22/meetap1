import { createClient } from "@supabase/supabase-js";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { computeSeries } from "@/server/metrics-series";
import { canonicalizeEventName, knownEventNames } from "@/server/event-dictionary";
import { parseWindow } from "@/server/admin-metrics";
import { DIAGNOSTICS_TABLES, probeTables } from "@/server/admin-tables";
import { getSeedMinimalStatus } from "@/server/seed-minimal";

type RlsRow = {
  table: string;
  can_select: boolean;
  note: string;
};

function boolEnv(name: string) {
  return Boolean(process.env[name] && process.env[name]?.length);
}

function shortError(msg?: string) {
  if (!msg) return "unknown";
  return msg.length > 200 ? `${msg.slice(0, 197)}...` : msg;
}

async function checkRls(table: string, probeColumn = "id"): Promise<RlsRow> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { table, can_select: false, note: "No anon client env" };

  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const probe = await anonClient
    .from(table)
    .select(probeColumn, { count: "exact", head: true })
    .limit(1);

  if (probe.error) return { table, can_select: false, note: shortError(probe.error.message) };
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
      SEED_MINIMAL_ENABLED:
        process.env.SEED_MINIMAL_ENABLED === "true" || process.env.NODE_ENV !== "production",
    };

    const [supabaseProbe, lastEvent, tableRows, rlsRows, topEvents24h, seriesProbe] =
      await Promise.all([
        supabaseAdmin.from("users").select("id", { count: "exact", head: true }).limit(1),
        supabaseAdmin
          .from("analytics_events")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1),
        probeTables(DIAGNOSTICS_TABLES, d24, d7, d30),
        Promise.all(
          [
            { table: "analytics_events", probe: "id" },
            { table: "reports", probe: "id" },
            { table: "feature_flags", probe: "id" },
            { table: "alerts", probe: "id" },
            { table: "event_dictionary", probe: "event_name" },
          ].map((t: any) => checkRls(t.table, t.probe)),
        ),
        supabaseAdmin
          .from("analytics_events")
          .select("event_name")
          .gte("created_at", d24)
          .limit(120000),
        (() => {
          const window = parseWindow(d7, new Date().toISOString(), 7);
          return computeSeries({
            metric: "dau",
            fromISO: window.fromISO,
            toISO: window.toISO,
            userIds: null,
          });
        })(),
      ]);

    const supabase_ok = !supabaseProbe.error;

    const eventMap = new Map<string, number>();
    for (const row of topEvents24h.data ?? []) {
      const canonical = canonicalizeEventName(row.event_name);
      eventMap.set(canonical, (eventMap.get(canonical) ?? 0) + 1);
    }

    const top_event_names = [...eventMap.entries()]
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map(([event_name, count_24h]) => ({ event_name, count_24h }));

    const event_counts_24h = {
      total: [...eventMap.values()].reduce((a: any, b: any) => a + b, 0),
      register_started: eventMap.get("register_started") ?? 0,
      telegram_verified: eventMap.get("telegram_verified") ?? 0,
      registration_completed: eventMap.get("registration_completed") ?? 0,
      profile_completed: eventMap.get("profile_completed") ?? 0,
      posts_duo: eventMap.get("post_published_daily_duo") ?? 0,
      posts_video: eventMap.get("post_published_video") ?? 0,
      event_joined: eventMap.get("event_joined") ?? 0,
      connect_sent: eventMap.get("connect_sent") ?? 0,
      connect_replied: eventMap.get("connect_replied") ?? 0,
      message_sent: eventMap.get("message_sent") ?? 0,
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

    const seedMinimal = {
      enabled: getSeedMinimalStatus().enabled,
      reason: getSeedMinimalStatus().reason,
      fix_steps: getSeedMinimalStatus().fixSteps,
    };

    const canReadAnalytics =
      rlsRows.find((x: any) => x.table === "analytics_events")?.can_select ?? false;
    const rlsIssues = rlsRows
      .filter((x: any) => !x.can_select)
      .map((x: any) => `${x.table}: ${x.note}`);

    const issues: string[] = [];
    const fixes: string[] = [];
    const recommended_fixes: Array<{
      key: string;
      title: string;
      why: string;
      action_endpoint?: string;
    }> = [];

    if (!supabase_ok) {
      issues.push(`Supabase connection failed: ${shortError(supabaseProbe.error?.message)}`);
      fixes.push("Проверь NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
    }

    for (const [key, value] of Object.entries(env)) {
      if (!value) issues.push(`ENV missing/disabled: ${key}`);
    }

    const missingTables = tableRows.filter((x: any) => !x.exists).map((x: any) => x.name);
    if (missingTables.length) {
      issues.push(`Missing tables: ${missingTables.join(", ")}`);
      fixes.push("Нажми Fix now или примени SQL миграции до последней версии.");
      recommended_fixes.push({
        key: "create_missing_tables",
        title: "Fix now",
        why: "Некоторые таблицы отсутствуют",
        action_endpoint: "/api/admin/fix/create-missing-tables",
      });
    }

    const analyticsTable = tableRows.find((x: any) => x.name === "analytics_events");
    const events24h = analyticsTable?.rows_24h ?? 0;

    if (events24h === 0) {
      issues.push("0 events in analytics_events for 24h");
      fixes.push("Нажми Check Tracking или включи трекинг analytics_events в приложении.");
      recommended_fixes.push({
        key: "write_test_event",
        title: "Write test event",
        why: "Проверка pipeline и графика",
        action_endpoint: "/api/admin/fix-common",
      });
      if (seedMinimal.enabled) {
        recommended_fixes.push({
          key: "seed_minimal",
          title: "Seed Minimal",
          why: "Быстрая проверка UI на пустом стенде",
          action_endpoint: "/api/admin/fix-common",
        });
      }
    }

    const known = new Set(knownEventNames());
    const unknownTop = top_event_names.filter((x: any) => !known.has(x.event_name));
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

    
    const metricsEndpoints = {
      series_ok: Array.isArray(seriesProbe.points),
      sample_points_count: seriesProbe.points.length,
      errors: Array.isArray(seriesProbe.points) ? undefined : "Series format mismatch",
    };

    if (metricsEndpoints.sample_points_count === 0 && events24h > 0) {
      issues.push("metrics/series returns empty points while events exist");
      fixes.push("Проверь диапазон дат/таймзону и mapping event names.");
      recommended_fixes.push({
        key: "write_test_event",
        title: "Write test event",
        why: "Проверка pipeline и графика",
        action_endpoint: "/api/admin/fix-common",
      });
    }

    recommended_fixes.push({
      key: "recompute_aggregates",
      title: "Recompute aggregates",
      why: "Пересчитать user_stats_daily",
      action_endpoint: "/api/admin/fix-common",
    });

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
      seed_minimal: seedMinimal,
      openai,
      can_read_analytics: canReadAnalytics,
      metrics_server_mode: true,
      metrics_source: "service_role",
      issues,
      fixes,
      recommended_fixes,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
