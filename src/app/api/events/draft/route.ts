import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { createEvent, updateEvent } from "@/server/events-service";

const schema = z.object({
  event_id: z.string().uuid().optional(),
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
  social_mode: z.string().trim().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    if (parsed.data.event_id) {
      await updateEvent(parsed.data.event_id, {
        title: parsed.data.title,
        category: parsed.data.category,
        city: parsed.data.city,
        venue_name: parsed.data.venue_name,
        venue_address: parsed.data.venue_address,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at ?? null,
        short_description: parsed.data.short_description,
        full_description: parsed.data.full_description,
        is_free: parsed.data.is_free,
        price_text: parsed.data.price_text,
        organizer_name: parsed.data.organizer_name,
        organizer_telegram: parsed.data.organizer_telegram,
        social_mode: parsed.data.social_mode ?? null,
        status: "draft",
      });
      return ok({ id: parsed.data.event_id, status: "draft" });
    }

    const id = await createEvent(
      {
        title: parsed.data.title,
        category: parsed.data.category,
        city: parsed.data.city,
        venue_name: parsed.data.venue_name,
        venue_address: parsed.data.venue_address,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at ?? null,
        short_description: parsed.data.short_description,
        full_description: parsed.data.full_description,
        is_free: parsed.data.is_free,
        price_text: parsed.data.price_text,
        organizer_name: parsed.data.organizer_name,
        organizer_telegram: parsed.data.organizer_telegram,
        social_mode: parsed.data.social_mode ?? null,
        status: "draft",
      },
      userId,
    );

    return ok({ id, status: "draft" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось сохранить черновик", 500);
  }
}
