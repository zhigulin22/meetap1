import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireAdminUserId } from "@/server/admin";

const schema = z.object({
  userId: z.string().uuid(),
  blocked: z.boolean(),
  reason: z.string().max(300).optional(),
  days: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: Request) {
  try {
    const adminUserId = await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const { userId, blocked, reason, days } = parsed.data;

    const blockedUntil = blocked ? new Date(Date.now() + (days ?? 30) * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        is_blocked: blocked,
        blocked_reason: blocked ? reason ?? "Moderation policy" : null,
        blocked_until: blockedUntil,
      })
      .eq("id", userId);

    if (error) return fail(error.message, 500);

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminUserId,
      target_user_id: userId,
      action: blocked ? "block_user" : "unblock_user",
      reason: reason ?? null,
      metadata: { days: blocked ? days ?? 30 : 0 },
    });

    if (blocked) {
      await supabaseAdmin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
    }

    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
