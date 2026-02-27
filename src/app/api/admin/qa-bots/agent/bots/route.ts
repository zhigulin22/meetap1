import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { ensureQaBotUsers } from "@/server/qa-bots";

const querySchema = z.object({
  count: z.coerce.number().int().min(1).max(200).default(30),
});

function validToken(req: Request) {
  const env = getServerEnv();
  const token = req.headers.get("x-qa-control-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token.length > 0 && token === env.QA_BOTS_CONTROL_TOKEN;
}

export async function GET(req: Request) {
  if (!validToken(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ count: searchParams.get("count") ?? undefined });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
  }

  const bots = await ensureQaBotUsers(parsed.data.count);
  return ok({ bots });
}
