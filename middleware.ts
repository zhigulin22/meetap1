import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";
import { getPublicEnv, getServerEnv } from "@/lib/env";

const protectedRoutes = ["/feed", "/events", "/contacts", "/profile", "/admin", "/messages"];
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

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

    if (!res.ok) return true;

    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.length > 0;
  } catch {
    return true;
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

    if (!res.ok) return { role: "user", blocked: false };

    const rows = (await res.json()) as Array<{ role?: string; is_blocked?: boolean; blocked_until?: string | null }>;
    const row = rows[0];

    if (!row) return { role: "user", blocked: false };

    const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : null;
    const blocked = Boolean(row.is_blocked) && (!blockedUntil || blockedUntil > Date.now());

    return { role: row.role ?? "user", blocked };
  } catch {
    return { role: "user", blocked: false };
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

  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!isProtected) {
    return response;
  }

  const userId = request.cookies.get("meetap_user_id")?.value;
  const verified = request.cookies.get("meetap_verified")?.value;
  const sessionId = request.cookies.get("meetap_session_id")?.value;

  if (!userId || verified !== "1") {
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    return NextResponse.redirect(url);
  }

  if (!sessionId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const active = await isSessionActive(userId, sessionId);
  if (!active) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirected = NextResponse.redirect(url);
    clearCookies(redirected);
    return redirected;
  }

  const access = await getUserAccess(userId);
  if (access.blocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirected = NextResponse.redirect(url);
    clearCookies(redirected);
    return redirected;
  }

  if (request.nextUrl.pathname.startsWith("/admin") && access.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
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
