import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";
import { getPublicEnv, getServerEnv } from "@/lib/env";

const protectedRoutes = ["/feed", "/events", "/contacts", "/profile", "/admin"];
const ADMIN_PORTAL_ROLES = ["admin", "super_admin"] as const;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function jsonError(status: number, code: string, message: string, hint: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      hint,
      endpoint: "middleware",
    },
    { status },
  );
}

async function isSessionActive(userId: string, sessionId: string) {
  try {
    const pub = getPublicEnv();
    const sec = getServerEnv();

    const url = new URL(`${pub.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_sessions`);
    url.searchParams.set("select", "id");
    url.searchParams.set("id", `eq.${sessionId}`);
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("revoked_at", "is.null");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        apikey: sec.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${sec.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function getUserAccess(userId: string) {
  try {
    const pub = getPublicEnv();
    const sec = getServerEnv();

    const url = new URL(`${pub.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users`);
    url.searchParams.set("select", "id,role,is_blocked,blocked_until");
    url.searchParams.set("id", `eq.${userId}`);
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        apikey: sec.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${sec.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return { role: "user", blocked: false, degraded: true };

    const rows = (await res.json()) as Array<{ role?: string; is_blocked?: boolean; blocked_until?: string | null }>;
    const row = rows[0];

    if (!row) return { role: "user", blocked: false, degraded: false };

    const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : null;
    const blocked = Boolean(row.is_blocked) && (!blockedUntil || blockedUntil > Date.now());

    return { role: row.role ?? "user", blocked, degraded: false };
  } catch {
    return { role: "user", blocked: false, degraded: true };
  }
}

async function touchSession(userId: string, sessionId: string) {
  try {
    const pub = getPublicEnv();
    const sec = getServerEnv();
    const now = new Date().toISOString();

    const url = new URL(`${pub.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_sessions`);
    url.searchParams.set("id", `eq.${sessionId}`);
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("revoked_at", "is.null");

    await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        apikey: sec.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${sec.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_active_at: now }),
      cache: "no-store",
    });
  } catch {
    // no-op
  }
}

function clearCookies(res: NextResponse) {
  res.cookies.set("meetap_user_id", "", { path: "/", maxAge: 0 });
  res.cookies.set("meetap_verified", "", { path: "/", maxAge: 0 });
  res.cookies.set("meetap_session_id", "", { path: "/", maxAge: 0 });
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isAgentApi = pathname.startsWith("/api/admin/qa-bots/agent/");
  const isAdminApi = pathname.startsWith("/api/admin") && !isAgentApi;
  const isAdminPage = pathname.startsWith("/admin");
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route)) || isAdminApi;

  if (!isProtected) {
    return response;
  }

  const userId = request.cookies.get("meetap_user_id")?.value;
  const verified = request.cookies.get("meetap_verified")?.value;
  const sessionId = request.cookies.get("meetap_session_id")?.value;

  if (!userId || verified !== "1") {
    if (isAdminApi) {
      return jsonError(401, "UNAUTHORIZED", "No active session", "Войди через /login под админ-аккаунтом");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    return NextResponse.redirect(url);
  }

  if (!sessionId) {
    if (isAdminApi) {
      return jsonError(401, "UNAUTHORIZED", "No active session id", "Войди через /login под админ-аккаунтом");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const active = await isSessionActive(userId, sessionId);
  if (!active) {
    if (isAdminApi) {
      const denied = jsonError(401, "UNAUTHORIZED", "Session revoked or expired", "Войди заново через /login");
      clearCookies(denied);
      return denied;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirected = NextResponse.redirect(url);
    clearCookies(redirected);
    return redirected;
  }

  const access = await getUserAccess(userId);
  if (access.blocked) {
    if (isAdminApi) {
      const denied = jsonError(403, "FORBIDDEN", "User blocked", "Аккаунт заблокирован");
      clearCookies(denied);
      return denied;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirected = NextResponse.redirect(url);
    clearCookies(redirected);
    return redirected;
  }

  const needsStrictAdmin = isAdminPage || isAdminApi;
  if (needsStrictAdmin) {
    if (access.degraded) {
      if (isAdminApi) {
        return jsonError(503, "ACCESS_DEGRADED", "Cannot verify admin role", "Проверь SUPABASE_SERVICE_ROLE_KEY и перезапусти деплой");
      }
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }

    if (!ADMIN_PORTAL_ROLES.includes(access.role as (typeof ADMIN_PORTAL_ROLES)[number])) {
      if (isAdminApi) {
        return jsonError(403, "FORBIDDEN", "Admin access denied", "Доступ только для ролей admin и super_admin");
      }
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }
  }

  if (isAdminApi) {
    const key = `${request.ip ?? "ip"}:${pathname}`;
    const now = Date.now();
    const globalAny = globalThis as unknown as { __adminRate?: Map<string, { count: number; resetAt: number }> };
    globalAny.__adminRate = globalAny.__adminRate ?? new Map();
    const store = globalAny.__adminRate;
    const hit = store.get(key);
    if (!hit || now > hit.resetAt) {
      store.set(key, { count: 1, resetAt: now + 60_000 });
    } else if (hit.count >= 120) {
      return new NextResponse("Too Many Requests", { status: 429 });
    } else {
      hit.count += 1;
    }
  }

  await touchSession(userId, sessionId);

  response.cookies.set("meetap_user_id", userId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  response.cookies.set("meetap_verified", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  response.cookies.set("meetap_session_id", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
