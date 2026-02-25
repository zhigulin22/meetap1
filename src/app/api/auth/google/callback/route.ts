import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { supabaseAdmin } from "@/supabase/admin";
import { detectDeviceLabel } from "@/lib/session";

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/register?error=google_cancelled`);
  }

  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !sessionData.user) {
    return NextResponse.redirect(`${origin}/register?error=google_failed`);
  }

  const authUser = sessionData.user;
  const email = authUser.email ?? "";
  const googleName = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? "";
  const googleAvatar = authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture ?? "";

  // Check if user already exists in our users table
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();

  if (existingUser?.id) {
    // Returning user — set session cookies and go to feed
    const deviceLabel = detectDeviceLabel(req.headers.get("user-agent") ?? "");
    const ipAddress = req.headers.get("x-forwarded-for") ?? null;

    const { data: session } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id: existingUser.id,
        device_label: deviceLabel,
        user_agent: req.headers.get("user-agent") ?? null,
        ip: ipAddress,
      })
      .select("id")
      .maybeSingle();

    const redirectRes = NextResponse.redirect(`${origin}/feed`);
    redirectRes.cookies.set("meetap_user_id", existingUser.id, COOKIE_BASE);
    redirectRes.cookies.set("meetap_verified", "1", COOKIE_BASE);
    if (session?.id) {
      redirectRes.cookies.set("meetap_session_id", session.id, COOKIE_BASE);
    }
    return redirectRes;
  }

  // New user — redirect to onboarding with Google profile data
  const params = new URLSearchParams({
    name: googleName,
    email,
    avatar: googleAvatar,
    supabase_uid: authUser.id,
  });

  return NextResponse.redirect(`${origin}/onboarding?${params.toString()}`);
}
