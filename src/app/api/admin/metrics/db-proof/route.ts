import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();

    const since2m = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const since10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const [rows2m, lastEvent] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since2m)
        .filter("properties->>source", "eq", "live_sim"),
      supabaseAdmin
        .from("analytics_events")
        .select("created_at,event_name,properties")
        .gte("created_at", since10m)
        .filter("properties->>source", "eq", "live_sim")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const count2m = rows2m.count ?? 0;
    const last = lastEvent.data?.[0] ?? null;

    return ok({
      events_last_2m: count2m,
      has_db_writes: count2m > 0,
      status: count2m > 0 ? "ok" : "error",
      last_db_event_at: last?.created_at ?? null,
      last_event_name: last?.event_name ?? null,
      reason: count2m > 0 ? null : "Simulation not writing to DB",
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
