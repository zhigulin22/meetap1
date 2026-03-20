import { supabaseAdmin } from "@/supabase/admin";
import { fail, ok } from "@/lib/http";
import { buildTelegramCode } from "@/lib/telegram-code";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const phone: string = body?.phone ?? "";
    const code: string = String(body?.code ?? "").trim();

    if (!phone || !code) return fail("phone and code required", 400);
    if (!/^\d{6}$/.test(code)) return fail("Код должен быть 6 цифр", 400);

    // Normalize phone same way as send endpoint
    const cleaned = phone.replace(/[\s()-]/g, "");
    const normalizedPhone = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

    // Find a verified record (bot already confirmed)
    const { data: verification } = await supabaseAdmin
      .from("telegram_verifications")
      .select("id, token, status, expires_at")
      .eq("phone", normalizedPhone)
      .eq("status", "verified")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also check pending — in case bot sent the code but status not yet updated to verified
    const { data: pendingVerification } = !verification
      ? await supabaseAdmin
          .from("telegram_verifications")
          .select("id, token, status, expires_at")
          .eq("phone", normalizedPhone)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const record = verification ?? pendingVerification;
    if (!record) return fail("Код истёк или не был запрошен. Нажми «Получить код» снова.", 400);

    const expectedCode = buildTelegramCode(record.token);
    if (code !== expectedCode) return fail("Неверный код", 400);

    // Mark as verified if not yet, and extend expiry to 30 min for onboarding
    if (record.status !== "verified") {
      await supabaseAdmin
        .from("telegram_verifications")
        .update({
          status: "verified",
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .eq("id", record.id);
    } else {
      // Already verified — just extend expiry
      await supabaseAdmin
        .from("telegram_verifications")
        .update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
        .eq("id", record.id);
    }

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    return ok({ ok: true, isNewUser: !existingUser, phone: normalizedPhone });
  } catch (e: any) {
    console.error("[verify] Unhandled error:", e?.message ?? e);
    return fail(`Внутренняя ошибка: ${e?.message ?? "unknown"}`, 500);
  }
}
