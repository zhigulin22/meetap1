import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";

const schema = z.object({
  eventName: z.string().min(2).max(80),
  path: z.string().max(300).optional(),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  await trackEvent({
    eventName: parsed.data.eventName,
    path: parsed.data.path ?? null,
    properties: parsed.data.properties ?? {},
    userId: getCurrentUserId(),
  });

  return ok({ success: true });
}
