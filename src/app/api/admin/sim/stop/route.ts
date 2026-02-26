import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { stopSimulation } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";

const schema = z.object({ run_id: z.string().uuid().optional() });

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    await stopSimulation(parsed.data.run_id);

    await logAdminAction({
      adminId,
      action: "simulation_stop",
      targetType: "simulation",
      targetId: parsed.data.run_id,
    });

    return ok({ status: "stopped" });
  } catch {
    return fail("Forbidden", 403);
  }
}
