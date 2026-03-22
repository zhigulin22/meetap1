import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getQaBotLogs } from "@/server/qa-bots";

const querySchema = z.object({
  bot_id: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(10).max(500).default(200),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);
    const { searchParams } = new URL(req.url);
    const botIdRaw = searchParams.get("bot_id")?.trim() ?? "";

    const parsed = querySchema.safeParse({
      bot_id: botIdRaw.length ? botIdRaw : undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const items = await getQaBotLogs({ botId: parsed.data.bot_id, limit: parsed.data.limit });
    return ok({ items });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
