import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { detectDeviceLabel } from "@/lib/session";
import { fail } from "@/lib/http";

const COOKIE_BASE = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone: string = body?.phone ?? "";

  if (!phone) return fail("phone required", 400);

  // Normalize phone
  const cleaned = phone.replace(/[\s()-]/g, "");
  const normalizedPhone = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

  // Check that phone was recently verified
  const { data: pending } = await supabaseAdmin
    .from("telegram_verifications")
    .select("id, telegram_user_id")
    .eq("phone", normalizedPhone)
    .eq("status", "verified")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return fail("Верификация не пройдена или истекла", 401);

  // Find the Meetap user
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (!user) return fail("Аккаунт не найден. Зарегистрируйся сначала.", 404);

  // Consume the pending record
  await supabaseAdmin
    .from("telegram_verifications")
    .update({ status: "expired" })
    .eq("id", pending.id);

  // Save telegram_user_id to users so future logins can send code directly
  if (pending.telegram_user_id) {
    await supabaseAdmin
      .from("users")
      .update({ telegram_user_id: pending.telegram_user_id })
      .eq("id", user.id)
      .is("telegram_user_id", null);
  }

  // Create session
  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for") ?? null;
  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: user.id,
      device_label: detectDeviceLabel(ua),
      user_agent: ua,
      ip,
    })
    .select("id")
    .maybeSingle();

  const res = NextResponse.json({ ok: true });
  res.cookies.set("meetap_user_id", user.id, COOKIE_BASE);
  res.cookies.set("meetap_verified", "1", COOKIE_BASE);
  if (session?.id) res.cookies.set("meetap_session_id", session.id, COOKIE_BASE);
  return res;
}
