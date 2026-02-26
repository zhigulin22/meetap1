import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus, getSimulationState } from "@/server/simulation";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();

    const [state, devtools] = await Promise.all([getSimulationState(), Promise.resolve(getDevtoolsStatus())]);

    const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [lastMinute, events24h] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("properties")
        .gte("created_at", minuteAgo)
        .limit(5000),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo)
        .then((x) => x.count ?? 0),
    ]);

    let epm = 0;
    for (const row of lastMinute.data ?? []) {
      const source = (row.properties as Record<string, unknown> | null)?.source;
      if (source === "live_sim") epm += 1;
    }

    return ok({
      devtools,
      running: state.running,
      run: state.run,
      events_per_minute: epm,
      events_24h: events24h,
      cron_warning: process.env.SIM_CRON_ENABLED === "true" ? null : "Cron disabled — Live работает пока открыта админка (auto tick fallback)",
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
