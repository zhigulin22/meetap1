import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { startTrafficRun } from "@/server/traffic";

const bodySchema = z.object({
  users_count: z.coerce.number().int().min(5).max(200).default(30),
  interval_sec: z.coerce.number().int().min(3).max(30).default(5),
  intensity: z.enum(["low", "normal", "high"]).default("normal"),
  chaos: z.coerce.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const run = await startTrafficRun({
      createdBy: adminId,
      usersCount: parsed.data.users_count,
      intervalSec: parsed.data.interval_sec,
      intensity: parsed.data.intensity,
      chaos: parsed.data.chaos,
    });

    await Promise.all([
      trackEvent({
        eventName: "admin_action",
        userId: adminId,
        path: "/admin",
        properties: {
          action: "traffic_start",
          run_id: run.id,
          users_count: run.users_count,
          interval_sec: run.interval_sec,
          intensity: run.intensity,
          chaos: run.chaos,
        },
      }),
      logAdminAction({
        adminId,
        action: "traffic_start",
        targetType: "traffic_run",
        targetId: run.id,
        meta: {
          users_count: run.users_count,
          interval_sec: run.interval_sec,
          intensity: run.intensity,
          chaos: run.chaos,
        },
      }),
    ]);

    return ok({
      ok: true,
      run_id: run.id,
      status: run.status,
      users_count: run.users_count,
      interval_sec: run.interval_sec,
      intensity: run.intensity,
      chaos: run.chaos,
      started_at: run.started_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start traffic";
    if (message === "Forbidden") return fail("Forbidden", 403);
    return fail(message, 400);
  }
}
