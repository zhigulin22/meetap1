import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { createEvent } from "@/server/events-service";

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  venue_name: z.string().trim().min(2).max(220),
  venue_address: z.string().trim().optional().default(""),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable().optional(),
  short_description: z.string().trim().min(10).max(320),
  full_description: z.string().trim().min(20).max(4000),
  is_free: z.boolean().optional().default(true),
  price_text: z.string().trim().optional().default(""),
  organizer_name: z.string().trim().optional().default(""),
  organizer_telegram: z.string().trim().optional().default(""),
});

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const id = await createEvent(parsed.data, userId);
    return ok({ id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось создать событие", 500);
  }
}

