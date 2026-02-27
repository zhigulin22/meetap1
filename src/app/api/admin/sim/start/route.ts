import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus, startSimulation } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";

const schema = z.object({
  users_count: z.number().int().min(10).max(2000).default(40),
  interval_sec: z.number().int().min(3).max(120).default(8),
  mode: z.enum(["normal", "chaos"]).default("normal"),
  intensity: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const status = await getDevtoolsStatus();
    if (!status.enabled) return fail(`Devtools disabled: ${status.reason}`, 403);

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const run = await startSimulation({
      adminId,
      usersCount: parsed.data.users_count,
      intervalSec: parsed.data.interval_sec,
      mode: parsed.data.mode,
      intensity: parsed.data.intensity,
    });

    await logAdminAction({
      adminId,
      action: "simulation_start",
      targetType: "simulation",
      targetId: run.id,
      meta: parsed.data,
    });

    return ok({ run_id: run.id, status: run.status, run });
  } catch {
    return fail("Forbidden", 403);
  }
}
