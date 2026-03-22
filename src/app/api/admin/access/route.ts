import { ok } from "@/lib/http";
import { getAdminAccess } from "@/server/admin";
import { permissionsForRole, roleHasPermission } from "@/lib/admin-rbac";
import { adminRouteError } from "@/server/admin-error";

export async function GET() {
  try {
    const access = await getAdminAccess();
    const role = access.role;

    return ok({
      role,
      can_admin: access.canAdmin,
      permissions: permissionsForRole(role),
      flags: {
        can_manage_roles: roleHasPermission(role, "rbac.manage"),
        can_manage_users: roleHasPermission(role, "users.action"),
        can_manage_risk: roleHasPermission(role, "risk.manage"),
        can_manage_config: roleHasPermission(role, "config.manage"),
        can_manage_traffic: roleHasPermission(role, "traffic.manage"),
      },
    });
  } catch (error) {
    return adminRouteError("/api/admin/access", error);
  }
}
