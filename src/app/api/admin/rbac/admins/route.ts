import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { ADMIN_ROLES, requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { supabaseAdmin } from "@/supabase/admin";

const roles = ["user", ...ADMIN_ROLES] as const;
const updateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(roles),
  reason: z.string().trim().min(2).max(240),
});

export async function GET() {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst"]);

    const [admins, history] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,role,created_at,email,username")
        .in("role", ADMIN_ROLES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("admin_audit_log")
        .select("id,admin_id,action,target_id,meta,created_at")
        .in("action", ["role_update", "role_grant", "role_revoke"])
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    return ok({
      admins: admins.data ?? [],
      history: history.data ?? [],
      roles: roles,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const current = await supabaseAdmin.from("users").select("id,role,name").eq("id", parsed.data.user_id).maybeSingle();
    if (current.error) return fail(current.error.message, 500);
    if (!current.data?.id) return fail("User not found", 404);

    const upd = await supabaseAdmin
      .from("users")
      .update({ role: parsed.data.role })
      .eq("id", parsed.data.user_id)
      .select("id,role,name")
      .single();

    if (upd.error) return fail(upd.error.message, 500);

    await logAdminAction({
      adminId,
      action: "role_update",
      targetType: "user",
      targetId: parsed.data.user_id,
      meta: {
        before_role: current.data.role ?? "user",
        after_role: parsed.data.role,
        reason: parsed.data.reason,
      },
    });

    return ok({ success: true, user: upd.data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
