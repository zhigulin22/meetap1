import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { addReport, trackEvent } from "@/server/analytics";

const schema = z.object({
  targetUserId: z.string().uuid().optional(),
  contentType: z.enum(["post", "event", "comment", "profile"]),
  contentId: z.string().uuid().optional(),
  reason: z.string().min(3).max(200),
  details: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    await addReport({
      reporterUserId: userId,
      targetUserId: parsed.data.targetUserId,
      contentType: parsed.data.contentType,
      contentId: parsed.data.contentId,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });

    await trackEvent({ eventName: "report_submitted", userId, path: "/feed", properties: { contentType: parsed.data.contentType } });

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
