import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export const ADMIN_ROLES = ["admin", "moderator", "analyst", "content_manager", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export class AdminAccessError extends Error {
  code: "UNAUTHORIZED" | "FORBIDDEN" | "MISSING_ENV" | "DB";
  hint?: string;

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN" | "MISSING_ENV" | "DB", message: string, hint?: string) {
    super(message);
    this.name = "AdminAccessError";
    this.code = code;
    this.hint = hint;
  }
}

function assertAdminEnv() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AdminAccessError(
      "MISSING_ENV",
      "SUPABASE_SERVICE_ROLE_KEY is missing",
      "Добавь SUPABASE_SERVICE_ROLE_KEY в Vercel env и redeploy",
    );
  }
}

export async function requireAdminUserId(allowedRoles: readonly string[] = ADMIN_ROLES) {
  assertAdminEnv();

  let userId: string;
  try {
    userId = requireUserId();
  } catch {
    throw new AdminAccessError("UNAUTHORIZED", "No active session", "Войди заново через /login");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,role,is_blocked,blocked_until")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AdminAccessError("DB", error.message, "Проверь доступ к users через SERVICE_ROLE");
  }

  const blockedUntil = data?.blocked_until ? new Date(data.blocked_until).getTime() : null;
  const stillBlocked = Boolean(data?.is_blocked) && (!blockedUntil || blockedUntil > Date.now());

  if (!data?.id || stillBlocked) {
    throw new AdminAccessError("FORBIDDEN", "User is blocked or missing", "Проверь user record и блокировки");
  }

  const role = data.role ?? "user";
  if (!allowedRoles.includes(role)) {
    throw new AdminAccessError("FORBIDDEN", `Role ${role} is not allowed`, "Назначь роль admin/moderator/analyst");
  }

  return userId;
}

export async function getAdminAccess() {
  assertAdminEnv();

  const userId = requireUserId();
  const { data, error } = await supabaseAdmin.from("users").select("id,role").eq("id", userId).maybeSingle();
  if (error) {
    throw new AdminAccessError("DB", error.message, "Проверь users table и SERVICE_ROLE");
  }

  return {
    userId,
    role: (data?.role ?? "user") as string,
    canAdmin: ADMIN_ROLES.includes((data?.role ?? "user") as AdminRole),
  };
}
