import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { TrafficEngineError, startTrafficRun } from "@/server/traffic";

const bodySchema = z.object({
  users_count: z.coerce.number().int().min(5).max(30).default(30),
  interval_sec: z.coerce.number().int().min(3).max(30).default(5),
  intensity: z.enum(["low", "normal", "high"]).default("normal"),
  chaos: z.coerce.boolean().default(false),
});

function withTimeout<T>(promise: Promise<T>, ms: number, step: () => string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TrafficEngineError("TIMEOUT", "TIMEOUT: traffic operation exceeded 1s", "Уменьши нагрузку start и проверь Supabase latency", step()));
    }, ms);
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
  let lastStep = "validate_admin";

  try {
    const adminId = await requireAdminUserId(["admin"]);

    lastStep = "parse_payload";
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422, {
        code: "VALIDATION",
        endpoint: "/api/admin/traffic/start",
      });
    }

    lastStep = "start_run";
    const run = await withTimeout(
      startTrafficRun({
        createdBy: adminId,
        usersCount: parsed.data.users_count,
        intervalSec: parsed.data.interval_sec,
        intensity: parsed.data.intensity,
        chaos: parsed.data.chaos,
      }),
      1000,
      () => lastStep,
    );
    lastStep = "log_admin_action";
    void Promise.all([
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
    ]).catch(() => undefined);

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
    if (error instanceof TrafficEngineError) {
      const status = error.code === "TIMEOUT" ? 504 : error.code === "VALIDATION" ? 422 : 500;
      return fail(error.message, status, {
        code: error.code,
        hint: error.hint,
        endpoint: "/api/admin/traffic/start",
        details: { last_step: error.step ?? lastStep },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown server error";
    const serviceFailed = message.toLowerCase().includes("service role");
    return fail(message, serviceFailed ? 500 : 500, {
      code: serviceFailed ? "SERVICE_ROLE_FAILED" : "DB",
      hint: "Проверь server logs и подключение к Supabase SERVICE_ROLE",
      endpoint: "/api/admin/traffic/start",
      details: { last_step: lastStep },
    });
  }
}
