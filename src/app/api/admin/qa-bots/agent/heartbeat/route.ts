import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { writeRunnerHeartbeat } from "@/server/qa-bots";

const schema = z.object({
  run_id: z.string().uuid().nullable().optional(),
  active_bots: z.number().int().min(0).max(500),
  events_written: z.number().int().min(0),
  actions: z
    .array(
      z.object({
        bot_id: z.string().min(1).max(120),
        bot: z.string().min(1).max(120),
        action: z.string().min(1).max(120),
        at: z.string(),
        event_name: z.string().min(2).max(120).optional(),
      }),
    )
    .max(300)
    .optional(),
  bot_states: z
    .array(
      z.object({
        bot_id: z.string().min(1).max(120),
        status: z.string().min(1).max(40).optional(),
        last_action: z.string().max(240).optional(),
        last_error: z.string().max(1200).nullable().optional(),
      }),
    )
    .max(500)
    .optional(),
  logs: z
    .array(
      z.object({
        bot_id: z.string().min(1).max(120),
        level: z.enum(["info", "warn", "error"]).default("info"),
        message: z.string().min(1).max(1200),
      }),
    )
    .max(200)
    .optional(),
});

function validToken(req: Request) {
  const env = getServerEnv();
  const token = req.headers.get("x-qa-control-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token.length > 0 && token === env.QA_BOTS_CONTROL_TOKEN;
}

export async function POST(req: Request) {
  try {
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
      botStates: parsed.data.bot_states,
      logs: parsed.data.logs,
    });

    return ok({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Heartbeat failed", 500);
  }
}
