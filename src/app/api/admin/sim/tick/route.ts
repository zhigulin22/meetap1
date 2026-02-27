import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAdminUserId } from "@/server/admin";
import { getSimulationState, runSimulationTick } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";
import { assertSimulationTablesReady } from "@/server/admin-tables";
import { adminError, hasServiceRoleKey, mapSimError } from "@/server/admin-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  run_id: z.string().uuid().optional(),
  events_per_tick: z.number().int().min(1).max(5000).optional(),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);

    if (!hasServiceRoleKey()) {
      return adminError(
        500,
        "SERVICE_ROLE_MISSING",
        "SUPABASE_SERVICE_ROLE_KEY is missing",
        "Добавь корректный SUPABASE_SERVICE_ROLE_KEY в env и redeploy.",
      );
    }

    await assertSimulationTablesReady();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return adminError(422, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Invalid payload", "Проверь run_id/events_per_tick.");
    }

    const state = await getSimulationState();
    const runId = parsed.data.run_id ?? state.run?.id;
    if (!runId) {
      return adminError(422, "RUN_NOT_FOUND", "No simulation run found", "Сначала нажми Start в Live Simulation.");
    }

    const result = await runSimulationTick(runId, parsed.data.events_per_tick);

    if (!result.dbWritten || result.eventsWritten <= 0) {
      return adminError(
        500,
        "DB_WRITE_FAILED",
        "Tick finished but no rows were written to analytics_events",
        "Проверь RLS, service role и таблицу analytics_events.",
      );
    }

    await logAdminAction({
      adminId,
      action: "simulation_tick",
      targetType: "simulation",
      targetId: runId,
      meta: {
        events_per_tick: parsed.data.events_per_tick ?? null,
        events_written: result.eventsWritten,
        db_written: result.dbWritten,
        last_db_event_at: result.lastDbEventAt,
      },
    });

    return NextResponse.json({
      ok: true,
      events_written: result.eventsWritten,
      last_db_event_at: result.lastDbEventAt,
      sample: result.sampleEvents,
      run_id: runId,
    });
  } catch (error) {
    const mapped = mapSimError(error);
    return adminError(mapped.status, mapped.code, mapped.message, mapped.hint, error);
  }
}
