import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getTrafficStatus } from "@/server/traffic";

const querySchema = z.object({
  run_id: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({ run_id: searchParams.get("run_id") ?? undefined });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const status = await getTrafficStatus(parsed.data.run_id ?? null);
    return ok(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message === "Forbidden") return fail("Forbidden", 403);
    return fail(message, 400);
  }
}
