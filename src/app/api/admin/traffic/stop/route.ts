import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { stopTrafficRun } from "@/server/traffic";

const bodySchema = z.object({
  run_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const result = await stopTrafficRun(parsed.data.run_id ?? null);

    await Promise.all([
      trackEvent({
        eventName: "admin_action",
        userId: adminId,
        path: "/admin",
        properties: { action: "traffic_stop", run_id: result.run_id },
      }),
      logAdminAction({
        adminId,
        action: "traffic_stop",
        targetType: "traffic_run",
        targetId: result.run_id,
      }),
    ]);

    return ok({ ok: true, ...result });
  } catch (error) {
    return adminRouteError("/api/admin/traffic/stop", error);
  }
}
