import { cookies } from "next/headers";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { type AdminRole, isAdminRole } from "@/lib/admin-rbac";

export const ADMIN_PORTAL_ROLES = ["admin", "super_admin"] as const;
export const ADMIN_ROLES = ADMIN_PORTAL_ROLES;

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

async function assertStrongSession(userId: string) {
  const cookieStore = cookies();
  const verified = cookieStore.get("meetap_verified")?.value;
  const sessionId = cookieStore.get("meetap_session_id")?.value;

  if (verified !== "1" || !sessionId) {
    throw new AdminAccessError("UNAUTHORIZED", "Invalid or missing admin session", "Войди заново через /login");
  }

  const { data, error } = await supabaseAdmin
    .from("user_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("user_sessions") && (message.includes("does not exist") || message.includes("schema cache"))) {
      throw new AdminAccessError("DB", "user_sessions table is missing", "Примени миграцию user_sessions и повтори");
    }
    throw new AdminAccessError("DB", error.message, "Проверь доступ к user_sessions через SERVICE_ROLE");
  }

  if (!data?.id) {
    throw new AdminAccessError("UNAUTHORIZED", "Session is not active", "Войди заново через /login");
  }
}

async function resolveAdminContext() {
  assertAdminEnv();

  let userId: string;
  try {
    userId = requireUserId();
  } catch {
    throw new AdminAccessError("UNAUTHORIZED", "No active session", "Войди заново через /login");
  }

  await assertStrongSession(userId);

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

  const role = (data.role ?? "user") as string;
  if (!ADMIN_PORTAL_ROLES.includes(role as (typeof ADMIN_PORTAL_ROLES)[number])) {
    throw new AdminAccessError(
      "FORBIDDEN",
      `Role ${role} cannot access admin panel`,
      "Доступ только для ролей admin и super_admin",
    );
  }

  return { userId, role: role as AdminRole };
}

export async function requireAdminUserId(allowedRoles: readonly string[] = ADMIN_PORTAL_ROLES) {
  const context = await resolveAdminContext();

  if (!allowedRoles.includes(context.role)) {
    throw new AdminAccessError(
      "FORBIDDEN",
      `Role ${context.role} is not allowed`,
      `Разрешённые роли: ${allowedRoles.join(", ")}`,
    );
  }

  return context.userId;
}

export async function getAdminAccess() {
  const context = await resolveAdminContext();

  return {
    userId: context.userId,
    role: context.role,
    canAdmin: isAdminRole(context.role),
  };
}
