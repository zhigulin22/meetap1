import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getServerEnv } from "@/lib/env";

async function sendMessage(chatId: string, text: string) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

export async function GET() {
  const env = getServerEnv();
  const chatIds = String(env.TELEGRAM_MODERATION_CHAT_ID || "")
    .split(/[;,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!chatIds.length) return ok({ ok: false, reason: "No chats" });

  const now = Date.now();
  const pendingOlder = new Date(now - 1000 * 60 * 60 * 2).toISOString();
  const inReviewOlder = new Date(now - 1000 * 60 * 60 * 6).toISOString();

  const [pendingRes, inReviewRes] = await Promise.all([
    supabaseAdmin
      .from("event_submissions")
      .select("id,title,created_at")
      .eq("moderation_status", "pending")
      .lt("created_at", pendingOlder)
      .limit(20),
    supabaseAdmin
      .from("event_submissions")
      .select("id,title,created_at")
      .eq("moderation_status", "in_review")
      .lt("created_at", inReviewOlder)
      .limit(20),
  ]);

  const pending = pendingRes.data ?? [];
  const inReview = inReviewRes.data ?? [];

  if (!pending.length && !inReview.length) return ok({ ok: true, sent: 0 });

  const lines: string[] = ["🔔 <b>Напоминание о модерации</b>", ""]; 

  if (pending.length) {
    lines.push(`<b>Ожидают проверки:</b> ${pending.length}`);
    lines.push(...pending.map((s: { id: string; title: string | null }) => `• ${s.title ?? "Без названия"} (<code>${s.id}</code>)`));
    lines.push("");
  }
  if (inReview.length) {
    lines.push(`<b>В работе > 6 часов:</b> ${inReview.length}`);
    lines.push(...inReview.map((s: { id: string; title: string | null }) => `• ${s.title ?? "Без названия"} (<code>${s.id}</code>)`));
  }

  const message = lines.filter(Boolean).join("\n");
  for (const chatId of chatIds) {
    await sendMessage(chatId, message);
  }

  return ok({ ok: true, sent: pending.length + inReview.length });
}
