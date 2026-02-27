import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSimulationState, runSimulationTick } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";
import { assertSimulationTablesReady } from "@/server/admin-tables";

const schema = z.object({
  run_id: z.string().uuid().optional(),
  events_per_tick: z.number().int().min(1).max(5000).optional(),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    await assertSimulationTablesReady();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const state = await getSimulationState();
    const runId = parsed.data.run_id ?? state.run?.id;
    if (!runId) return fail("No simulation run found", 422);

    const result = await runSimulationTick(runId, parsed.data.events_per_tick);

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

    return ok({
      run_id: runId,
      events_written: result.eventsWritten,
      db_written: result.dbWritten,
      last_db_event_at: result.lastDbEventAt,
      sample_events: result.sampleEvents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message.toLowerCase().includes("missing tables")) return fail(message, 409);
    if (message === "Forbidden") return fail(message, 403);
    return fail(message, 400);
  }
}
