export const ADMIN_READ_ROLES = ["support", "moderator", "analyst", "admin", "super_admin"] as const;
export const ADMIN_WRITE_ROLES = ["moderator", "admin", "super_admin"] as const;
export const ADMIN_CONFIG_ROLES = ["admin", "super_admin"] as const;
export const SUPER_ADMIN_ONLY = ["super_admin"] as const;

export type AdminRole = (typeof ADMIN_READ_ROLES)[number];

export type AdminPermission =
  | "users.read"
  | "users.action"
  | "reports.read"
  | "reports.manage"
  | "risk.read"
  | "risk.manage"
  | "metrics.read"
  | "exports.aggregate"
  | "exports.full"
  | "config.manage"
  | "experiments.manage"
  | "traffic.manage"
  | "demo.reset"
  | "rbac.view"
  | "rbac.manage"
  | "security.manage"
  | "integrations.manage";

const PERMISSION_MATRIX: Record<AdminRole, AdminPermission[]> = {
  support: ["users.read", "reports.read", "rbac.view"],
  moderator: ["users.read", "users.action", "reports.read", "reports.manage", "risk.read", "risk.manage", "rbac.view"],
  analyst: ["metrics.read", "exports.aggregate", "rbac.view", "users.read", "risk.read", "reports.read"],
  admin: [
    "users.read",
    "users.action",
    "reports.read",
    "reports.manage",
    "risk.read",
    "risk.manage",
    "metrics.read",
    "exports.aggregate",
    "exports.full",
    "config.manage",
    "experiments.manage",
    "traffic.manage",
    "demo.reset",
    "rbac.view",
    "rbac.manage",
    "security.manage",
    "integrations.manage",
  ],
  super_admin: [
    "users.read",
    "users.action",
    "reports.read",
    "reports.manage",
    "risk.read",
    "risk.manage",
    "metrics.read",
    "exports.aggregate",
    "exports.full",
    "config.manage",
    "experiments.manage",
    "traffic.manage",
    "demo.reset",
    "rbac.view",
    "rbac.manage",
    "security.manage",
    "integrations.manage",
  ],
};

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_READ_ROLES as readonly string[]).includes(role);
}

export function roleHasPermission(role: string, permission: AdminPermission) {
  if (!isAdminRole(role)) return false;
  return PERMISSION_MATRIX[role].includes(permission);
}

export function permissionsForRole(role: string): AdminPermission[] {
  if (!isAdminRole(role)) return [];
  return PERMISSION_MATRIX[role];
}
