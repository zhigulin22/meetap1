import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";
import { getPublicEnv, getServerEnv } from "@/lib/env";

const protectedRoutes = ["/feed", "/events", "/contacts", "/profile"];

async function isSessionActive(userId: string, sessionId: string) {
  try {
    const pub = getPublicEnv();
    const sec = getServerEnv();

    const url = new URL(`${pub.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_sessions`);
    url.searchParams.set("select", "id,last_active_at");
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

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

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
    redirected.cookies.set("meetap_user_id", "", { path: "/", maxAge: 0 });
    redirected.cookies.set("meetap_verified", "", { path: "/", maxAge: 0 });
    redirected.cookies.set("meetap_session_id", "", { path: "/", maxAge: 0 });
    return redirected;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
