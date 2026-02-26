import { createClient } from "@supabase/supabase-js";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus } from "@/server/simulation";
import { supabaseAdmin } from "@/supabase/admin";

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
];

function boolEnv(name: string) {
  return Boolean(process.env[name] && process.env[name]?.length);
}

function shortError(msg?: string) {
  if (!msg) return "unknown";
  return msg.length > 160 ? `${msg.slice(0, 157)}...` : msg;
}

async function tableWindowCount(table: string, dateColumn: string, sinceISO: string) {
  const probe = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).limit(1);
  if (probe.error) return { exists: false, count: 0 };

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

    const [supabaseProbe, lastEvent, tableRows, rlsRows, keyCounts24h] = await Promise.all([
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
      Promise.all(["analytics_events", "reports", "feature_flags", "alerts"].map((t) => checkRls(t))),
      supabaseAdmin
        .from("analytics_events")
        .select("event_name", { count: "exact" })
        .gte("created_at", d24)
        .in("event_name", [
          "register_started",
          "telegram_verified",
          "registration_completed",
          "profile_completed",
          "post_published_daily_duo",
          "post_published_video",
          "event_joined",
          "connect_sent",
          "connect_replied",
          "chat_message_sent",
          "ai_error",
        ]),
    ]);

    const supabase_ok = !supabaseProbe.error;

    const eventMap = new Map<string, number>();
    for (const row of keyCounts24h.data ?? []) {
      eventMap.set(row.event_name, (eventMap.get(row.event_name) ?? 0) + 1);
    }

    const devtools = getDevtoolsStatus();
    const openai = {
      enabled: env.OPENAI_API_KEY,
      reason: env.OPENAI_API_KEY ? "OPENAI_API_KEY found" : "OPENAI_API_KEY missing",
    };

    const canReadAnalytics = rlsRows.find((x) => x.table === "analytics_events")?.can_select ?? false;

    const issues: string[] = [];
    const fixes: string[] = [];

    if (!supabase_ok) {
      issues.push(`Supabase connection failed: ${shortError(supabaseProbe.error?.message)}`);
      fixes.push("Проверь NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
    }

    for (const [key, value] of Object.entries(env)) {
      if (!value) {
        issues.push(`ENV missing/disabled: ${key}`);
      }
    }

    if (!env.ADMIN_DEVTOOLS_ENABLED) {
      fixes.push("Включи ADMIN_DEVTOOLS_ENABLED=true для devtools в production.");
    }

    const missingTables = tableRows.filter((x) => !x.exists).map((x) => x.name);
    if (missingTables.length) {
      issues.push(`Missing tables: ${missingTables.join(", ")}`);
      fixes.push("Примени SQL миграции до 011 включительно.");
    }

    const analyticsTable = tableRows.find((x) => x.name === "analytics_events");
    if ((analyticsTable?.rows_24h ?? 0) === 0) {
      issues.push("0 events in analytics_events for 24h");
      fixes.push("Нажми Start Live 40 Users или Seed Minimal.");
    }

    if (!canReadAnalytics) {
      issues.push("RLS/permissions: cannot read analytics_events via anon");
      fixes.push("Проверь RLS policies, либо читай через server routes (service role).\n");
    }

    const event_counts_24h = {
      total: analyticsTable?.rows_24h ?? 0,
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

    return ok({
      env,
      supabase_ok,
      tables: tableRows,
      rls: rlsRows,
      last_event_at: lastEvent.data?.[0]?.created_at ?? null,
      event_counts_24h,
      devtools: {
        enabled: devtools.enabled,
        reason: devtools.reason,
      },
      openai,
      issues,
      fixes,
      can_read_analytics: canReadAnalytics,
      devtools_reason: devtools.reason,
      openai_reason: openai.reason,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
