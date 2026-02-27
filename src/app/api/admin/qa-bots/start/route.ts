import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { startQaBots } from "@/server/qa-bots";
import { trackEvent } from "@/server/analytics";

const schema = z.object({
  users_count: z.number().int().min(1).max(200).optional(),
  interval_sec: z.number().int().min(2).max(60).optional(),
  mode: z.enum(["normal", "chaos"]).optional(),
});

export async function POST(req: Request) {
  try {
    const adminUserId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const result = await startQaBots({
      adminUserId,
      usersCount: parsed.data.users_count,
      intervalSec: parsed.data.interval_sec,
      mode: parsed.data.mode,
    });

    await trackEvent({
      eventName: "admin_action",
      userId: adminUserId,
      path: "/admin",
      properties: { action: "qa_bots_start", run_id: result.run_id, users_count: result.users_count },
    });

    return ok({ ok: true, ...result });
  } catch {
    return fail("Forbidden", 403);
  }
}
