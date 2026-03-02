import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getAdminAccess, requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { supabaseAdmin } from "@/supabase/admin";

const managedRoles = ["support", "moderator", "analyst", "admin", "super_admin"] as const;
const roles = ["user", ...managedRoles] as const;

const updateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(roles),
  reason: z.string().trim().min(2).max(240),
});

export async function GET() {
  try {
    const access = await getAdminAccess();

    const [admins, history] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,role,created_at,email,username")
        .in("role", managedRoles as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("admin_audit_log")
        .select("id,admin_id,action,target_id,meta,created_at")
        .in("action", ["role_update", "role_grant", "role_revoke"])
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const canManage = ["admin", "super_admin"].includes(access.role);
    const visibleRoles = access.role === "super_admin" ? roles : roles.filter((r) => r !== "super_admin");

    return ok({
      admins: admins.data ?? [],
      history: history.data ?? [],
      roles: visibleRoles,
      current_role: access.role,
      can_manage_roles: canManage,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin", "super_admin"]);
    const access = await getAdminAccess();

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    if (access.role !== "super_admin" && parsed.data.role === "super_admin") {
      return fail("Only super_admin can grant super_admin", 403);
    }

    const current = await supabaseAdmin.from("users").select("id,role,name").eq("id", parsed.data.user_id).maybeSingle();
    if (current.error) return fail(current.error.message, 500);
    if (!current.data?.id) return fail("User not found", 404);

    const beforeRole = String(current.data.role ?? "user");

    if (access.role !== "super_admin" && beforeRole === "super_admin") {
      return fail("Only super_admin can modify super_admin", 403);
    }

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
        before_role: beforeRole,
        after_role: parsed.data.role,
        reason: parsed.data.reason,
      },
    });

    return ok({ success: true, user: upd.data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
