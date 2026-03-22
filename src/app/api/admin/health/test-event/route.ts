import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { trackEvent } from "@/server/analytics";

export async function POST() {
  try {
    const adminId = await requireAdminUserId();
    await trackEvent({ eventName: "admin_test_event", userId: adminId, path: "/admin", properties: { source: "health-check" } });
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
