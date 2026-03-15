import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { dryRunTraffic, TrafficEngineError } from "@/server/traffic";

const querySchema = z.object({
  run_id: z.string().uuid().optional(),
  users_count: z.coerce.number().int().min(5).max(30).optional(),
  interval_sec: z.coerce.number().int().min(3).max(30).optional(),
  intensity: z.enum(["low", "normal", "high"]).optional(),
  chaos: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      run_id: searchParams.get("run_id") ?? undefined,
      users_count: searchParams.get("users_count") ?? undefined,
      interval_sec: searchParams.get("interval_sec") ?? undefined,
      intensity: searchParams.get("intensity") ?? undefined,
      chaos: searchParams.get("chaos") ?? undefined,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422, {
        code: "VALIDATION",
        endpoint: "/api/admin/traffic/dry-run",
      });
    }

    const result = await dryRunTraffic({
      runId: parsed.data.run_id ?? null,
      usersCount: parsed.data.users_count,
      intervalSec: parsed.data.interval_sec,
      intensity: parsed.data.intensity,
      chaos: parsed.data.chaos,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof TrafficEngineError) {
      return fail(error.message, 500, {
        code: error.code,
        hint: error.hint,
        endpoint: "/api/admin/traffic/dry-run",
        details: { last_step: error.step },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown server error";
    return fail(message, 500, {
      code: message.toLowerCase().includes("service role") ? "SERVICE_ROLE_FAILED" : "DB",
      hint: "Проверь server logs и подключение к Supabase SERVICE_ROLE",
      endpoint: "/api/admin/traffic/dry-run",
    });
  }
}
