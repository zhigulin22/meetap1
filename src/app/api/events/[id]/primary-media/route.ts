import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { setPrimaryEventImage } from "@/server/event-media";

const schema = z.object({ media_id: z.string().uuid() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    requireUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail("Некорректные данные", 422);
    }

    await setPrimaryEventImage(params.id, parsed.data.media_id);
    return ok({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось обновить обложку", 500);
  }
}

