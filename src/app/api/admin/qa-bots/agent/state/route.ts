import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { getRunnerDesiredState } from "@/server/qa-bots";

function validToken(req: Request) {
  const env = getServerEnv();
  const token = req.headers.get("x-qa-control-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token.length > 0 && token === env.QA_BOTS_CONTROL_TOKEN;
}

export async function GET(req: Request) {
  if (!validToken(req)) return fail("Unauthorized", 401);

  const state = await getRunnerDesiredState();
  return ok({ ok: true, state });
}
