import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { writeRunnerHeartbeat } from "@/server/qa-bots";

const schema = z.object({
  run_id: z.string().uuid().nullable().optional(),
  active_bots: z.number().int().min(0).max(200),
  events_written: z.number().int().min(0),
  actions: z
    .array(
      z.object({
        bot: z.string(),
        action: z.string(),
        at: z.string(),
      }),
    )
    .max(30)
    .optional(),
});

function validToken(req: Request) {
  const env = getServerEnv();
  const token = req.headers.get("x-qa-control-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token.length > 0 && token === env.QA_BOTS_CONTROL_TOKEN;
}

export async function POST(req: Request) {
  if (!validToken(req)) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  await writeRunnerHeartbeat({
    runId: parsed.data.run_id,
    activeBots: parsed.data.active_bots,
    eventsWritten: parsed.data.events_written,
    actions: parsed.data.actions,
  });

  return ok({ ok: true });
}
