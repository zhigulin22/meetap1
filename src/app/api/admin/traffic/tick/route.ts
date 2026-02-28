import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { getTrafficStatus, tickTrafficRun } from "@/server/traffic";

const bodySchema = z.object({
  run_id: z.string().uuid().optional(),
});

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT: traffic operation exceeded 8s")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const status = await getTrafficStatus(parsed.data.run_id ?? null);
    if (!status.run || status.run.status !== "running") {
      return fail("Traffic is not running", 409);
    }

    const result = await withTimeout(tickTrafficRun(parsed.data.run_id ?? null));

    await Promise.all([
      trackEvent({
        eventName: "admin_action",
        userId: adminId,
        path: "/admin",
        properties: {
          action: "traffic_tick",
          run_id: status.run.id,
          events_written: result.events_written,
        },
      }),
      logAdminAction({
        adminId,
        action: "traffic_tick",
        targetType: "traffic_run",
        targetId: status.run.id,
        meta: {
          events_written: result.events_written,
          last_event_at: result.last_event_at,
        },
      }),
    ]);

    return ok({
      ok: true,
      run_id: status.run.id,
      db_written: result.events_written > 0,
      events_written: result.events_written,
      last_db_event_at: result.last_event_at,
      sample_events: result.sample_events,
    });
  } catch (error) {
    return adminRouteError("/api/admin/traffic/tick", error);
  }
}
