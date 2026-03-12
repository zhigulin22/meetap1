import { ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { adminRouteError } from "@/server/admin-error";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

const REQUIRED_CATEGORIES = ["sports", "concerts", "arts", "quests", "standup", "exhibitions"];

export async function GET() {
  try {
    await requireAdminUserId(["admin", "super_admin"]);

    const schema = await getSchemaSnapshot(["events", "event_import_jobs", "import_jobs"]);
    const eventsCols = asSet(schema, "events");
    const newJobCols = asSet(schema, "event_import_jobs");
    const legacyJobCols = asSet(schema, "import_jobs");

    const jobTable: "event_import_jobs" | "import_jobs" | null = newJobCols.size
      ? "event_import_jobs"
      : legacyJobCols.size
        ? "import_jobs"
        : null;

    let latestJob: Record<string, unknown> | null = null;

    if (jobTable) {
      const jobRes = await supabaseAdmin
        .from(jobTable)
        .select("id,source_name,status,started_at,finished_at,stats_json,error_text,meta,errors")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!jobRes.error) latestJob = (jobRes.data as Record<string, unknown> | null) ?? null;
    }

    if (!eventsCols.size) {
      return ok({
        ok: false,
        job_table: jobTable,
        latest_job: latestJob,
        categories: REQUIRED_CATEGORIES.map((category) => ({ category, total: 0, target: 15, ok: false })),
        issues: ["events table missing"],
      });
    }

    let q = supabaseAdmin
      .from("events")
      .select("category,source_name,starts_at,event_date")
      .in("source_name", ["kudago", "timepad", "seed"])
      .limit(50000);

    if (eventsCols.has("source_type")) q = q.eq("source_type", "external");
    else if (eventsCols.has("source_kind")) q = q.eq("source_kind", "external");

    if (eventsCols.has("status")) q = q.eq("status", "published");

    const eventsRes = await q;

    const counts = new Map<string, number>();
    for (const row of eventsRes.data ?? []) {
      const category = typeof row.category === "string" ? row.category.trim().toLowerCase() : "";
      if (!category) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    const categories = REQUIRED_CATEGORIES.map((category) => {
      const total = counts.get(category) ?? 0;
      return {
        category,
        total,
        target: 15,
        ok: total >= 15,
      };
    });

    const issues = categories
      .filter((x) => !x.ok)
      .map((x) => `Категория ${x.category}: ${x.total}/15`);

    return ok({
      ok: issues.length === 0,
      job_table: jobTable,
      latest_job: latestJob,
      categories,
      issues,
      next_steps:
        issues.length === 0
          ? []
          : [
              "Запусти POST /api/admin/import-events",
              "Проверь KUDAGO_BASE_URL/TIMEPAD_TOKEN",
              "Если внешние источники недоступны, будет seed fallback",
            ],
    });
  } catch (error) {
    return adminRouteError("/api/admin/import-events/status", error);
  }
}
