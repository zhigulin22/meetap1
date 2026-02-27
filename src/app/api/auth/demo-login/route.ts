import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { detectDeviceLabel } from "@/lib/session";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";
import { trackEvent } from "@/server/analytics";

function applyAuthCookies(userId: string, sessionId: string | null) {
  const store = cookies();
  const base = {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  };

  store.set("meetap_user_id", userId, base);
  store.set("meetap_verified", "1", base);
  if (sessionId) {
    store.set("meetap_session_id", sessionId, base);
  }
}

export async function GET(req: Request) {
  try {
    const env = getServerEnv();
    if (!env.DEMO_AUTH_ENABLED) {
      return fail("Demo auth disabled", 403);
    }

    const url = new URL(req.url);
    const botId = url.searchParams.get("bot_id")?.trim();
    const phone = url.searchParams.get("phone")?.trim();

    if (!botId && !phone) {
      return fail("bot_id or phone is required", 422);
    }

    let query = supabaseAdmin
      .from("users")
      .select("id,name,phone,is_demo,demo_group,is_blocked,blocked_until")
      .eq("is_demo", true)
      .limit(1);

    if (botId) query = query.eq("id", botId);
    if (phone) query = query.eq("phone", phone);

    let userRes = await query.maybeSingle();

    if (userRes.error && userRes.error.message.toLowerCase().includes("demo_group")) {
      let fallback = supabaseAdmin
        .from("users")
        .select("id,name,phone,is_demo,is_blocked,blocked_until")
        .eq("is_demo", true)
        .limit(1);
      if (botId) fallback = fallback.eq("id", botId);
      if (phone) fallback = fallback.eq("phone", phone);
      userRes = await fallback.maybeSingle();
    }

    const user = userRes.data as any;
    if (!user?.id) {
      return fail("Demo user not found", 404);
    }

    if ((user.demo_group && user.demo_group !== "qa_bots") || !user.is_demo) {
      return fail("Not a QA bot demo user", 403);
    }

    const blockedUntil = user.blocked_until ? new Date(user.blocked_until).getTime() : null;
    if (user.is_blocked && (!blockedUntil || blockedUntil > Date.now())) {
      return fail("Demo user blocked", 403);
    }

    const deviceLabel = detectDeviceLabel(req.headers.get("user-agent") ?? "");
    const ip = req.headers.get("x-forwarded-for") ?? null;

    const { data: session } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id: user.id,
        device_label: `${deviceLabel} (demo)` ,
        user_agent: req.headers.get("user-agent") ?? null,
        ip,
      })
      .select("id")
      .maybeSingle();

    applyAuthCookies(user.id, session?.id ?? null);

    await trackEvent({
      eventName: "app.session_start",
      userId: user.id,
      path: "/api/auth/demo-login",
      properties: {
        demo_group: "qa_bots",
        source: "demo_login",
      },
    });

    return NextResponse.redirect(new URL("/feed", req.url));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Demo login failed", 500);
  }
}
