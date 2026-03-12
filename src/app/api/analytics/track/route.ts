import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";

const schema = z
  .object({
    event_name: z.string().min(2).max(120).optional(),
    eventName: z.string().min(2).max(120).optional(),
    path: z.string().max(300).optional(),
    properties: z.record(z.unknown()).optional(),
  })
  .refine((v: any) => Boolean(v.event_name || v.eventName), {
    message: "event_name is required",
    path: ["event_name"],
  });

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const eventName = parsed.data.event_name ?? parsed.data.eventName;
    if (!eventName) {
      return fail("event_name is required", 422);
    }

    await trackEvent({
      eventName,
      path: parsed.data.path ?? null,
      properties: parsed.data.properties ?? {},
      userId,
    });

    return ok({ ok: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
