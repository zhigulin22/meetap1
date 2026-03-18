import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { supabaseAdmin } from "@/supabase/admin";
import { getSchemaSnapshot } from "@/server/schema-introspect";

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
    errors.push(`${attempt.fn}: ${error.message}`);
  }

  return { ok: false as const, errors };
}

export async function POST() {
  try {
    const adminId = await requireAdminUserId(["admin"]);

    const sql = `
      alter table public.users add column if not exists city text;
      alter table public.users add column if not exists is_demo boolean not null default false;
      alter table public.users add column if not exists demo_group text;
    `;

    const run = await executeSqlWithRpc(sql);
    if (!run.ok) {
      return fail(`SQL RPC is unavailable. Apply SQL manually: alter table users add city/is_demo/demo_group. ${run.errors[0] ?? ""}`.trim(), 500);
    }

    const schema = await getSchemaSnapshot(["users"]);

    await logAdminAction({
      adminId,
      action: "schema_add_optional_columns",
      targetType: "schema",
      targetId: "users",
      meta: { method: run.method, columns: schema.users ?? [] },
    });

    return ok({
      ok: true,
      table: "users",
      columns: schema.users ?? [],
      added: ["city", "is_demo", "demo_group"],
      method: run.method,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message === "Forbidden") return fail("Forbidden", 403);
    return fail(message, 400);
  }
}
