import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { tickTrafficRun, TrafficEngineError } from "@/server/traffic";

const bodySchema = z.object({
  run_id: z.string().uuid().optional(),
});

function withTimeout<T>(promise: Promise<T>, ms: number, step: () => string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new TrafficEngineError(
          "TIMEOUT",
          "TIMEOUT: traffic operation exceeded 2s",
          "Уменьши batch_size и проверь latency Supabase; повтори tick",
          step(),
        ),
      );
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
        endpoint: "/api/admin/traffic/tick",
      });
    }

    lastStep = "tick_run";
    const result = await withTimeout(tickTrafficRun(parsed.data.run_id ?? null), 2500, () => lastStep);

    lastStep = "log_admin_action";
    void Promise.all([
      trackEvent({
        eventName: "admin_action",
        userId: adminId,
        path: "/admin",
        properties: {
          action: "traffic_tick",
          run_id: result.run_id,
          events_written: result.events_written,
          batch_size_used: result.batch_size_used,
          duration_ms: result.duration_ms,
        },
      }),
      logAdminAction({
        adminId,
        action: "traffic_tick",
        targetType: "traffic_run",
        targetId: result.run_id,
        meta: {
          events_written: result.events_written,
          last_event_at: result.last_event_at,
          duration_ms: result.duration_ms,
          batch_size_used: result.batch_size_used,
          next_batch_size: result.next_batch_size,
        },
      }),
    ]).catch(() => undefined);

    return ok({
      ok: true,
      run_id: result.run_id,
      db_written: result.events_written > 0,
      events_written: result.events_written,
      last_db_event_at: result.last_event_at,
      sample_events: result.sample_events,
      duration_ms: result.duration_ms,
      batch_size_used: result.batch_size_used,
      next_batch_size: result.next_batch_size,
    });
  } catch (error) {
    if (error instanceof TrafficEngineError) {
      const status = error.code === "TIMEOUT" ? 504 : error.code === "VALIDATION" ? 422 : 500;
      return fail(error.message, status, {
        code: error.code,
        hint: error.hint,
        endpoint: "/api/admin/traffic/tick",
        details: { last_step: error.step ?? lastStep },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown server error";
    const serviceFailed = message.toLowerCase().includes("service role");
    return fail(message, 500, {
      code: serviceFailed ? "SERVICE_ROLE_FAILED" : "DB",
      hint: "Проверь server logs и подключение к Supabase SERVICE_ROLE",
      endpoint: "/api/admin/traffic/tick",
      details: { last_step: lastStep },
    });
  }
}
