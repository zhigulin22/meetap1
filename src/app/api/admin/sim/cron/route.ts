import { fail, ok } from "@/lib/http";
import { runSimulationCronTick } from "@/server/simulation";

export async function POST(req: Request) {
  const cronSecret = process.env.SIM_CRON_SECRET;
  if (cronSecret) {
    const incoming = req.headers.get("x-sim-cron-secret") ?? "";
    if (incoming !== cronSecret) return fail("Forbidden", 403);
  }

  try {
    const result = await runSimulationCronTick();
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "cron failed", 500);
  }
}
