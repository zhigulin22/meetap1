import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function requireAdminUserId() {
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

  if (data.role !== "admin") {
    throw new Error("Forbidden");
  }

  return userId;
}
