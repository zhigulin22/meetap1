import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getQaBotsProof } from "@/server/qa-bots";

const querySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(30).default(2),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({ minutes: searchParams.get("minutes") ?? undefined });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const proof = await getQaBotsProof(parsed.data.minutes);
    return ok(proof);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
