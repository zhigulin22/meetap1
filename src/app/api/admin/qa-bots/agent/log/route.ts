import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { writeQaBotLogs } from "@/server/qa-bots";

const schema = z.object({
  run_id: z.string().uuid().nullable().optional(),
  logs: z
    .array(
      z.object({
        bot_id: z.string().min(1).max(120),
        level: z.enum(["info", "warn", "error"]).default("info"),
        message: z.string().min(1).max(1200),
      }),
    )
    .min(1)
    .max(200),
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

  await writeQaBotLogs({
    runId: parsed.data.run_id,
    logs: parsed.data.logs,
  });

  return ok({ ok: true, inserted: parsed.data.logs.length });
}
