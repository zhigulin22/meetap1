import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { detectDeviceLabel } from "@/lib/session";
import { trackEvent } from "@/server/analytics";
import { z } from "zod";

const schema = z.object({
  supabase_uid: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(60),
  age: z.number().int().min(13).max(100).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, "Только a-z, 0-9, _").optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 422 },
    );
  }

  const { supabase_uid, email, name, age, username, avatar_url } = parsed.data;

  // Check username uniqueness
  if (username) {
    const { data: taken } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (taken) {
      return NextResponse.json({ error: "Этот username уже занят" }, { status: 409 });
    }
  }

  // Check email uniqueness (race condition guard)
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId: string;

  if (existing?.id) {
    userId = existing.id;
  } else {
    userId = supabase_uid;

    const { error: insertErr } = await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      name: name.trim(),
      age: age ?? null,
      username: username ?? null,
      avatar_url: avatar_url ?? null,
      auth_provider: "google",
      telegram_verified: false,
      xp: 10, // welcome bonus
      level: 1,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  const deviceLabel = detectDeviceLabel(req.headers.get("user-agent") ?? "");
  const ipAddress = req.headers.get("x-forwarded-for") ?? null;

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: userId,
      device_label: deviceLabel,
      user_agent: req.headers.get("user-agent") ?? null,
      ip: ipAddress,
    })
    .select("id")
    .maybeSingle();

  const cookieStore = cookies();
  cookieStore.set("meetap_user_id", userId, COOKIE_BASE);
  cookieStore.set("meetap_verified", "1", COOKIE_BASE);
  if (session?.id) {
    cookieStore.set("meetap_session_id", session.id, COOKIE_BASE);
  }

  await trackEvent({
    eventName: "registration_completed",
    userId,
    path: "/onboarding",
    properties: { mode: "register", provider: "google" },
  });

  return NextResponse.json({ ok: true, userId });
}
