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

const usernameRegex = /^[a-z0-9_]{3,30}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone: string = body?.phone ?? "";
  const username: string = (body?.username ?? "").trim().toLowerCase();
  const name: string = (body?.name ?? "").trim();
  const gender: string = body?.gender ?? "";
  const city: string = (body?.city ?? "").trim();
  const birthYear: number | null = body?.birth_year ?? null;
  const educationType: string = body?.education_type ?? "";
  const schoolGrade: number | null = body?.school_grade ?? null;
  const universityName: string = (body?.university ?? "").trim();
  const photoUrl: string = body?.photo_url ?? "";

  if (!phone) return fail("phone required", 400);
  if (!usernameRegex.test(username)) {
    return fail("Имя пользователя: 3–30 символов, только a-z, 0-9 и _", 400);
  }
  if (name.length < 2) return fail("Имя: минимум 2 символа", 400);

  // Check verified pending record
  const { data: pending } = await supabaseAdmin
    .from("telegram_verifications")
    .select("id, telegram_user_id")
    .eq("phone", phone)
    .eq("status", "verified")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return fail("Верификация не пройдена или истекла", 401);

  // Check username uniqueness
  const { data: existingUsername } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUsername) return fail("Имя пользователя уже занято", 409);

  // Check phone uniqueness
  const { data: existingPhone } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingPhone) return fail("Аккаунт с этим номером уже существует", 409);

  // Base fields that always exist in the schema
  const baseInsert = {
    phone,
    name,
    username,
    auth_provider: "telegram" as const,
    telegram_user_id: pending.telegram_user_id ?? null,
    city: city || null,
    birth_year: birthYear ?? null,
    school_grade: educationType === "school" ? schoolGrade : null,
    university: educationType === "university" && universityName ? universityName : null,
    avatar_url: photoUrl || null,
    xp: 10,
    level: 1,
  };

  // Try with onboarding fields first; fall back to base if columns not migrated yet
  let newUser: { id: string } | null = null;
  let insertError: { message?: string; code?: string } | null = null;

  const fullResult = await supabaseAdmin
    .from("users")
    .insert({ ...baseInsert, gender: gender || null, education_type: educationType || null })
    .select("id")
    .maybeSingle();

  if (fullResult.error?.code === "PGRST204") {
    // Columns not yet migrated – insert without them
    console.warn("[complete] falling back to base insert (missing columns)");
    const baseResult = await supabaseAdmin
      .from("users")
      .insert(baseInsert)
      .select("id")
      .maybeSingle();
    newUser = baseResult.data;
    insertError = baseResult.error;
  } else {
    newUser = fullResult.data;
    insertError = fullResult.error;
  }

  if (insertError || !newUser) {
    console.error("[complete] insert error:", insertError?.message);
    return fail("Ошибка создания аккаунта", 500);
  }

  await supabaseAdmin
    .from("telegram_verifications")
    .update({ status: "expired" })
    .eq("id", pending.id);

  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for") ?? null;
  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: newUser.id,
      device_label: detectDeviceLabel(ua),
      user_agent: ua,
      ip,
    })
    .select("id")
    .maybeSingle();

  const res = NextResponse.json({ ok: true, userId: newUser.id });
  res.cookies.set("meetap_user_id", newUser.id, COOKIE_BASE);
  res.cookies.set("meetap_verified", "1", COOKIE_BASE);
  if (session?.id) res.cookies.set("meetap_session_id", session.id, COOKIE_BASE);
  return res;
}
