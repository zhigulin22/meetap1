import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { getServerEnv } from "@/lib/env";
import { trackEvent } from "@/server/analytics";

async function sendTelegramMessage(chatId: string, text: string) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => null);
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();

    const { error } = await supabaseAdmin
      .from("event_members")
      .upsert({ event_id: params.id, user_id: userId }, { onConflict: "event_id,user_id" });

    if (error) {
      return fail(error.message, 500);
    }

    const [{ data: event }, { data: user }] = await Promise.all([
      supabaseAdmin.from("events").select("title,starts_at,event_date").eq("id", params.id).maybeSingle(),
      supabaseAdmin.from("users").select("name,telegram_user_id").eq("id", userId).single(),
    ]);

    if (event && user?.telegram_user_id) {
      const rawDate = event.starts_at || event.event_date;
      const dateText = rawDate ? new Date(rawDate).toLocaleString("ru-RU") : "Дата уточняется";
      await sendTelegramMessage(
        String(user.telegram_user_id),
        `Ты зарегистрирован(а) на событие "${event.title}".\nДата: ${dateText}\nМы напомним ближе к началу.`,
      );
    }

    await trackEvent({ eventName: "events.joined", userId, path: "/events", properties: { eventId: params.id } });

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}

