import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus, getSimulationState, runSimulationTick, startSimulation, stopSimulation } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";

const schema = z.object({
  action: z.enum(["start", "stop", "tick"]),
  intervalSec: z.number().int().min(3).max(120).optional(),
  eventsPerTick: z.number().int().min(1).max(5000).optional(),
  users: z.number().int().min(10).max(2000).optional(),
  mode: z.enum(["normal", "chaos"]).optional(),
  intensity: z.enum(["low", "normal", "high"]).optional(),
});

export async function GET() {
  try {
    await requireAdminUserId();
    const state = await getSimulationState();
    return ok({
      running: state.running,
      intervalSec: state.run?.interval_sec ?? 8,
      eventsPerTick: state.run?.intensity === "high" ? 80 : state.run?.intensity === "low" ? 25 : 50,
      totalGenerated: state.run?.total_events_generated ?? 0,
      lastTickAt: state.run?.last_tick_at ? new Date(state.run.last_tick_at).getTime() : 0,
      runId: state.run?.id ?? null,
      recentActions: state.run?.recent_actions ?? [],
    });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const devtools = await getDevtoolsStatus();
    if (!devtools.enabled) return fail(`Devtools disabled: ${devtools.reason}`, 403);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    if (parsed.data.action === "start") {
      const run = await startSimulation({
        adminId,
        usersCount: parsed.data.users ?? 40,
        intervalSec: parsed.data.intervalSec ?? 8,
        mode: parsed.data.mode ?? "normal",
        intensity: parsed.data.intensity ?? "normal",
      });
      await logAdminAction({ adminId, action: "live_sim_start", targetType: "simulation", targetId: run.id, meta: parsed.data });
      return ok({
        running: true,
        intervalSec: run.interval_sec,
        eventsPerTick: parsed.data.eventsPerTick ?? 50,
        totalGenerated: run.total_events_generated,
        lastTickAt: run.last_tick_at ? new Date(run.last_tick_at).getTime() : 0,
        runId: run.id,
        recentActions: run.recent_actions ?? [],
      });
    }

    const state = await getSimulationState();
    const runId = state.run?.id;

    if (parsed.data.action === "stop") {
      await stopSimulation(runId);
      await logAdminAction({ adminId, action: "live_sim_stop", targetType: "simulation", targetId: runId ?? null });
      return ok({ running: false, intervalSec: state.run?.interval_sec ?? 8, eventsPerTick: parsed.data.eventsPerTick ?? 50, totalGenerated: state.run?.total_events_generated ?? 0, lastTickAt: Date.now(), runId: runId ?? null, recentActions: state.run?.recent_actions ?? [] });
    }

    if (!runId) return fail("No active simulation", 422);
    const tick = await runSimulationTick(runId, parsed.data.eventsPerTick);
    const refresh = await getSimulationState();
    return ok({
      running: true,
      intervalSec: refresh.run?.interval_sec ?? 8,
      eventsPerTick: parsed.data.eventsPerTick ?? 50,
      totalGenerated: refresh.run?.total_events_generated ?? tick.eventsWritten,
      lastTickAt: refresh.run?.last_tick_at ? new Date(refresh.run.last_tick_at).getTime() : Date.now(),
      runId,
      recentActions: tick.sampleEvents,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
