import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export const ADMIN_ROLES = ["admin", "moderator", "analyst", "content_manager", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export async function requireAdminUserId(allowedRoles: readonly string[] = ADMIN_ROLES) {
  const userId = requireUserId();

  const { data } = await supabaseAdmin
    .from("users")
    .select("id,role,is_blocked,blocked_until")
    .eq("id", userId)
    .maybeSingle();

  const blockedUntil = data?.blocked_until ? new Date(data.blocked_until).getTime() : null;
  const stillBlocked = Boolean(data?.is_blocked) && (!blockedUntil || blockedUntil > Date.now());

  if (!data?.id || stillBlocked) {
    throw new Error("Forbidden");
  }

  if (!allowedRoles.includes(data.role ?? "user")) {
    throw new Error("Forbidden");
  }

  return userId;
}

export async function getAdminAccess() {
  const userId = requireUserId();
  const { data } = await supabaseAdmin.from("users").select("id,role").eq("id", userId).maybeSingle();

  return {
    userId,
    role: (data?.role ?? "user") as string,
    canAdmin: ADMIN_ROLES.includes((data?.role ?? "user") as AdminRole),
  };
}
