import { fail } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const ALLOWED = {
  users: ["id", "name", "phone", "role", "telegram_verified", "created_at"],
  reports: ["id", "content_type", "reason", "status", "created_at"],
  events: ["id", "title", "city", "event_date", "price"],
  feature_flags: ["id", "key", "enabled", "rollout", "updated_at"],
  experiments: ["id", "key", "status", "rollout_percent", "primary_metric"],
} as const;

function toCSV(headers: string[], rows: Array<Record<string, unknown>>) {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const table = String(searchParams.get("table") ?? "");

    if (!(table in ALLOWED)) return fail("Unsupported table", 422);

    const cols = ALLOWED[table as keyof typeof ALLOWED];
    const { data, error } = await supabaseAdmin.from(table).select(cols.join(",")).limit(5000);
    if (error) return fail(error.message, 500);

    const csv = toCSV(cols as unknown as string[], (data ?? []) as Array<Record<string, unknown>>);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}.csv"`,
      },
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
