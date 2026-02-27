import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { stopQaBots } from "@/server/qa-bots";
import { trackEvent } from "@/server/analytics";

export async function POST() {
  try {
    const adminUserId = await requireAdminUserId(["admin"]);
    const result = await stopQaBots(adminUserId);

    await trackEvent({
      eventName: "admin_action",
      userId: adminUserId,
      path: "/admin",
      properties: { action: "qa_bots_stop", run_id: result.run_id },
    });

    return ok({ ok: true, ...result });
  } catch {
    return fail("Forbidden", 403);
  }
}
