import { supabaseAdmin } from "@/supabase/admin";
import { eventDictionarySeedRows } from "@/server/event-dictionary";

export type ProbeTable = {
  name: string;
  probeColumn: string;
  dateColumn?: string | null;
};

export const DIAGNOSTICS_TABLES: ProbeTable[] = [
  { name: "users", probeColumn: "id", dateColumn: "created_at" },
  { name: "events", probeColumn: "id", dateColumn: "created_at" },
  { name: "analytics_events", probeColumn: "id", dateColumn: "created_at" },
  { name: "reports", probeColumn: "id", dateColumn: "created_at" },
  { name: "content_flags", probeColumn: "id", dateColumn: "created_at" },
  { name: "feature_flags", probeColumn: "id", dateColumn: "updated_at" },
  { name: "experiments", probeColumn: "id", dateColumn: "updated_at" },
  { name: "alerts", probeColumn: "id", dateColumn: "updated_at" },
  { name: "moderation_actions", probeColumn: "id", dateColumn: "created_at" },
  { name: "admin_audit_log", probeColumn: "id", dateColumn: "created_at" },
  { name: "simulation_runs", probeColumn: "id", dateColumn: "created_at" },
  { name: "simulation_users", probeColumn: "id", dateColumn: "created_at" },
  { name: "risk_signals", probeColumn: "id", dateColumn: "created_at" },
  { name: "event_dictionary", probeColumn: "event_name", dateColumn: "updated_at" },
  { name: "user_stats_daily", probeColumn: "id", dateColumn: "created_at" },
  { name: "system_settings", probeColumn: "key", dateColumn: "updated_at" },
];

export const SIM_REQUIRED_TABLES: ProbeTable[] = [
  { name: "analytics_events", probeColumn: "id", dateColumn: "created_at" },
  { name: "simulation_runs", probeColumn: "id", dateColumn: "updated_at" },
  { name: "simulation_users", probeColumn: "id", dateColumn: "created_at" },
  { name: "users", probeColumn: "id", dateColumn: "created_at" },
  { name: "event_dictionary", probeColumn: "event_name", dateColumn: "updated_at" },
  { name: "system_settings", probeColumn: "key", dateColumn: "updated_at" },
  { name: "user_stats_daily", probeColumn: "id", dateColumn: "created_at" },
];

export const FIXABLE_TABLES: ProbeTable[] = [
  { name: "event_dictionary", probeColumn: "event_name", dateColumn: "updated_at" },
  { name: "system_settings", probeColumn: "key", dateColumn: "updated_at" },
];

export type ProbedTable = {
  name: string;
  exists: boolean;
  rows_24h: number;
  rows_7d: number;
  rows_30d: number;
  error?: string;
};

function isMissingTableError(message?: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("could not find the table") ||
    m.includes("schema cache")
  );
}

function shortError(message?: string) {
  if (!message) return "unknown";
  return message.length > 200 ? `${message.slice(0, 197)}...` : message;
}

async function tableScopedCount(table: ProbeTable, sinceISO: string) {
  const probe = await supabaseAdmin
    .from(table.name)
    .select(table.probeColumn, { count: "exact", head: true })
    .limit(1);

  if (probe.error) {
    return {
      exists: false,
      count: 0,
      error: shortError(probe.error.message),
      missing: isMissingTableError(probe.error.message),
    };
  }

  if (!table.dateColumn) {
    return { exists: true, count: probe.count ?? 0, missing: false };
  }

  const scoped = await supabaseAdmin
    .from(table.name)
    .select(table.probeColumn, { count: "exact", head: true })
    .gte(table.dateColumn, sinceISO)
    .limit(1);

  if (scoped.error) {
    const fallback = await supabaseAdmin
      .from(table.name)
      .select(table.probeColumn, { count: "exact", head: true })
      .limit(1);

    if (fallback.error) {
      return {
        exists: false,
        count: 0,
        error: shortError(fallback.error.message),
        missing: isMissingTableError(fallback.error.message),
      };
    }

    return { exists: true, count: fallback.count ?? 0, missing: false };
  }

  return { exists: true, count: scoped.count ?? 0, missing: false };
}

export async function probeTables(
  tables: ProbeTable[],
  d24ISO: string,
  d7ISO: string,
  d30ISO: string,
): Promise<ProbedTable[]> {
  return Promise.all(
    tables.map(async (table) => {
      const [a, b, c] = await Promise.all([
        tableScopedCount(table, d24ISO),
        tableScopedCount(table, d7ISO),
        tableScopedCount(table, d30ISO),
      ]);

      return {
        name: table.name,
        exists: a.exists || b.exists || c.exists,
        rows_24h: a.count,
        rows_7d: b.count,
        rows_30d: c.count,
        error: a.error ?? b.error ?? c.error,
      };
    }),
  );
}

export async function getMissingTableNames(tables: ProbeTable[]) {
  const now = Date.now();
  const rows = await probeTables(
    tables,
    new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  );

  return rows.filter((x) => !x.exists).map((x) => x.name);
}

export async function assertSimulationTablesReady() {
  const missing = await getMissingTableNames(SIM_REQUIRED_TABLES);
  if (!missing.length) return;
  throw new Error(
    `Cannot start simulation: missing tables ${missing.join(", ")}. Нажми Fix now в Data Health.`,
  );
}

async function executeSqlWithRpc(sql: string) {
  const attempts: Array<{ fn: string; args: Record<string, unknown> }> = [
    { fn: "exec_sql", args: { sql } },
    { fn: "exec_sql", args: { query: sql } },
    { fn: "run_sql", args: { sql } },
    { fn: "run_sql", args: { query: sql } },
    { fn: "execute_sql", args: { sql } },
    { fn: "execute_sql", args: { query: sql } },
    { fn: "query", args: { query: sql } },
    { fn: "query", args: { sql } },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const { error } = await supabaseAdmin.rpc(attempt.fn, attempt.args);
    if (!error) return { ok: true as const, method: `${attempt.fn}(${Object.keys(attempt.args)[0]})` };
    errors.push(`${attempt.fn}: ${shortError(error.message)}`);
  }

  return { ok: false as const, errors };
}

async function seedAdminTables() {
  await supabaseAdmin
    .from("system_settings")
    .upsert(
      [
        {
          key: "admin_devtools_safe_mode",
          value: {
            enabled: false,
            note: "Enable only for admin when live simulation is required in production.",
          },
          updated_at: new Date().toISOString(),
        },
        {
          key: "brand",
          value: { title: "Meetap", support_email: "support@meetap.app" },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" },
    );

  await supabaseAdmin
    .from("event_dictionary")
    .upsert(eventDictionarySeedRows(), { onConflict: "event_name" });
}

export async function createMissingAdminTables() {
  const missingBefore = await getMissingTableNames(FIXABLE_TABLES);

  if (missingBefore.length > 0) {
    const sql = `
      create table if not exists public.system_settings (
        key text primary key,
        value jsonb not null default '{}'::jsonb,
        updated_by uuid,
        updated_at timestamptz not null default now()
      );

      create table if not exists public.event_dictionary (
        event_name text primary key,
        family text not null,
        display_ru text not null,
        metric_tags text[] not null default '{}',
        is_key boolean not null default false,
        aliases text[] not null default '{}',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists idx_event_dictionary_family on public.event_dictionary(family);
      create index if not exists idx_event_dictionary_is_key on public.event_dictionary(is_key);
    `;

    const exec = await executeSqlWithRpc(sql);
    if (!exec.ok) {
      throw new Error(
        `Auto-fix SQL failed. Create RPC function exec_sql/run_sql or apply migrations 009+012 manually. ${exec.errors[0] ?? ""}`.trim(),
      );
    }
  }

  await seedAdminTables();

  const missingAfter = await getMissingTableNames(FIXABLE_TABLES);
  return {
    created: true,
    tables_present: missingAfter.length === 0,
    missing_before: missingBefore,
    missing_after: missingAfter,
  };
}
