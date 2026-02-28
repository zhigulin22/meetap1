import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";

const schema = z.object({
  action: z.enum(["limit_messaging", "unlimit_messaging", "shadowban", "unshadowban", "block", "unblock", "mark_safe"]),
  reason: z.string().max(240).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdminUserId(["admin", "moderator"]);
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const userId = params.id;
    const action = parsed.data.action;
    const reason = parsed.data.reason ?? null;

    if (action === "limit_messaging") await supabaseAdmin.from("users").update({ message_limited: true }).eq("id", userId);
    if (action === "unlimit_messaging") await supabaseAdmin.from("users").update({ message_limited: false }).eq("id", userId);
    if (action === "shadowban") await supabaseAdmin.from("users").update({ shadow_banned: true }).eq("id", userId);
    if (action === "unshadowban") await supabaseAdmin.from("users").update({ shadow_banned: false }).eq("id", userId);
    if (action === "block") {
      await supabaseAdmin
        .from("users")
        .update({ is_blocked: true, blocked_reason: reason ?? "Admin action", blocked_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", userId);
      await supabaseAdmin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
    }
    if (action === "unblock") await supabaseAdmin.from("users").update({ is_blocked: false, blocked_reason: null, blocked_until: null }).eq("id", userId);
    if (action === "mark_safe") await supabaseAdmin.from("users").update({ is_blocked: false, shadow_banned: false, message_limited: false }).eq("id", userId);

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminId,
      target_user_id: userId,
      action,
      reason,
      metadata: { source: "user_360" },
    });

    await logAdminAction({ adminId, action, targetType: "user", targetId: userId, meta: { reason } });
    await trackEvent({ eventName: "admin_action", userId: adminId, path: `/admin/users/${userId}`, properties: { action } });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id,is_blocked,shadow_banned,message_limited,blocked_reason,blocked_until")
      .eq("id", userId)
      .single();

    return ok({ success: true, user });
  } catch (error) {
    return adminRouteError("/api/admin/users/[id]/actions", error);
  }
}
