import { createClient } from "@supabase/supabase-js";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

type TableCheck = {
  name: string;
  exists: boolean;
  rows_30d: number;
};

type RlsCheck = {
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
];

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return value.includes("placeholder") || value.includes("example.com");
}

function shortError(message: string | undefined) {
  if (!message) return "unknown";
  return message.length > 160 ? `${message.slice(0, 157)}...` : message;
}

async function checkTable(table: string, dateColumn: string, sinceISO: string): Promise<TableCheck> {
  const existsProbe = await supabaseAdmin.from(table).select("*", { count: "exact", head: true }).limit(1);
  if (existsProbe.error) {
    return {
      name: table,
      exists: false,
      rows_30d: 0,
    };
  }

  const rangeProbe = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(dateColumn, sinceISO)
    .limit(1);

  if (!rangeProbe.error) {
    return {
      name: table,
      exists: true,
      rows_30d: rangeProbe.count ?? 0,
    };
  }

  const totalProbe = await supabaseAdmin.from(table).select("*", { count: "exact", head: true }).limit(1);
  return {
    name: table,
    exists: !totalProbe.error,
    rows_30d: totalProbe.count ?? 0,
  };
}

async function checkRls(table: string): Promise<RlsCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      table,
      can_select: false,
      note: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY не заданы",
    };
  }

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const probe = await client.from(table).select("*", { count: "exact", head: true }).limit(1);
  if (probe.error) {
    return {
      table,
      can_select: false,
      note: shortError(probe.error.message),
    };
  }

  return {
    table,
    can_select: true,
    note: "Чтение доступно через anon/public policies",
  };
}

export async function GET() {
  try {
    await requireAdminUserId();

    const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const envChecks = {
      NEXT_PUBLIC_SUPABASE_URL: !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY),
      OPENAI_API_KEY: !isPlaceholder(process.env.OPENAI_API_KEY),
      TELEGRAM_BOT_TOKEN: !isPlaceholder(process.env.TELEGRAM_BOT_TOKEN),
    };
    const env_ok = Object.values(envChecks).every(Boolean);

    const supabaseProbe = await supabaseAdmin.from("users").select("id", { count: "exact", head: true }).limit(1);
    const supabase_ok = !supabaseProbe.error;

    const [tables, rls, lastEvent] = await Promise.all([
      Promise.all(TABLES.map((table) => checkTable(table.name, table.dateColumn, sinceISO))),
      Promise.all(["analytics_events", "reports", "feature_flags", "alerts"].map(checkRls)),
      supabaseAdmin.from("analytics_events").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);

    const issues: string[] = [];
    const fixes: string[] = [];

    if (!env_ok) {
      const missing = Object.entries(envChecks).filter(([, ok]) => !ok).map(([key]) => key);
      issues.push(`Не заполнены env: ${missing.join(", ")}`);
      fixes.push("Добавьте отсутствующие ENV в Vercel Project Settings -> Environment Variables.");
    }

    if (!supabase_ok) {
      issues.push(`Supabase недоступен: ${shortError(supabaseProbe.error?.message)}`);
      fixes.push("Проверьте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY, затем redeploy.");
    }

    for (const table of tables) {
      if (!table.exists) {
        issues.push(`Таблица ${table.name} не найдена.`);
        fixes.push(`Примените миграции Supabase для ${table.name}.`);
      }
    }

    const analyticsTable = tables.find((table) => table.name === "analytics_events");
    if (analyticsTable?.exists && analyticsTable.rows_30d === 0) {
      issues.push("В analytics_events нет событий за 30 дней.");
      fixes.push("Запустите DevTools -> Simulation (30d) или проверьте вызовы trackEvent.");
    }

    for (const policy of rls) {
      if (!policy.can_select) {
        issues.push(`RLS ограничивает чтение ${policy.table}: ${policy.note}`);
        fixes.push(`Проверьте policies для ${policy.table} или используйте server API routes c service role.`);
      }
    }

    return ok({
      env_ok,
      supabase_ok,
      tables,
      rls,
      last_event_at: lastEvent.data?.[0]?.created_at ?? null,
      issues,
      fixes,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
