import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { getDevtoolsStatus, seedMinimalData, startSimulation } from "@/server/simulation";
import { supabaseAdmin } from "@/supabase/admin";

export async function POST() {
  try {
    const adminId = await requireAdminUserId();
    const actions: string[] = [];

    await trackEvent({ eventName: "admin_test_event", userId: adminId, path: "/admin", properties: { source: "fix_common" } });
    actions.push("written admin_test_event");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const eventsCount = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .then((x) => x.count ?? 0);

    if (eventsCount === 0) {
      const devtools = getDevtoolsStatus();
      if (devtools.enabled) {
        const seeded = await seedMinimalData();
        actions.push(`seed_minimal:${seeded.events}`);

        const run = await startSimulation({
          adminId,
          usersCount: 40,
          intervalSec: 8,
          mode: "normal",
          intensity: "normal",
        });
        actions.push(`live_started:${run.id}`);
      } else {
        actions.push(`devtools_disabled:${devtools.reason}`);
      }
    }

    await logAdminAction({ adminId, action: "fix_common_issues", targetType: "system", meta: { actions } });
    return ok({ success: true, actions });
  } catch {
    return fail("Forbidden", 403);
  }
}
