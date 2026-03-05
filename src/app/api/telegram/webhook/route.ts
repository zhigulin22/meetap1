import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { buildTelegramCode } from "@/lib/telegram-code";
import { getServerEnv } from "@/lib/env";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";

type ModerationAction = "approve" | "reject" | "need_info";

async function sendTelegramMessage(chatId: string, text: string, options?: { reply_markup?: unknown }) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(options?.reply_markup ? { reply_markup: options.reply_markup } : {}),
    }),
  }).catch(() => null);
}

async function answerCallbackQuery(id: string, text: string) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text, show_alert: false }),
  }).catch(() => null);
}

async function resolveAdminByTelegram(telegramUserId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,role")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (!data?.id) return { adminUserId: null as string | null, canModerate: false };
  const role = String(data.role ?? "user");
  return { adminUserId: data.id as string, canModerate: role === "admin" || role === "super_admin" || role === "moderator" };
}

async function logSubmissionAction(input: {
  submissionId: string;
  action: string;
  actorUserId?: string | null;
  note?: string;
  payload?: Record<string, unknown>;
}) {
  const schema = await getSchemaSnapshot(["event_submission_moderation_log"]);
  const cols = asSet(schema, "event_submission_moderation_log");
  if (!cols.size) return;

  const insertPayload = pickExistingColumns(
    {
      submission_id: input.submissionId,
      action: input.action,
      actor_user_id: input.actorUserId ?? null,
      via: "telegram_bot",
      note: input.note ?? null,
      payload: input.payload ?? {},
    },
    cols,
  );

  await supabaseAdmin.from("event_submission_moderation_log").insert(insertPayload).catch(() => null);
}

async function publishSubmission(submission: any, moderatorUserId: string | null) {
  const schema = await getSchemaSnapshot(["events", "event_submissions"]);
  const eventsCols = asSet(schema, "events");
  const subCols = asSet(schema, "event_submissions");

  if (!eventsCols.size || !subCols.size) {
    throw new Error("Missing events/submission schema");
  }

  const startsAt = submission.starts_at ?? new Date().toISOString();

  const eventPayload = pickExistingColumns(
    {
      title: submission.title,
      description: submission.short_description,
      short_description: submission.short_description,
      full_description: submission.full_description,
      city: submission.city,
      location: submission.address,
      venue_name: submission.address,
      venue_address: submission.address,
      starts_at: startsAt,
      event_date: startsAt,
      ends_at: submission.ends_at ?? null,
      cover_url: Array.isArray(submission.cover_urls) ? submission.cover_urls[0] ?? null : null,
      category: submission.category,
      source_kind: "community",
      social_mode: submission.mode,
      is_paid: submission.is_paid,
      price: submission.price ?? 0,
      price_note: submission.price ? `${submission.price} ₽` : null,
      payment_url: submission.payment_url ?? null,
      payment_note: submission.payment_note ?? null,
      organizer_telegram: submission.telegram_contact,
      participant_limit: submission.participant_limit ?? null,
      looking_for_count: submission.looking_for_count ?? null,
      moderation_status: "published",
      status: "published",
      submission_id: submission.id,
      source_meta: {
        submission_id: submission.id,
        mode: submission.mode,
        covers: Array.isArray(submission.cover_urls) ? submission.cover_urls : [],
      },
    },
    eventsCols,
  );

  const insertRes = await supabaseAdmin.from("events").insert(eventPayload).select("id").single();
  if (insertRes.error || !insertRes.data?.id) {
    throw new Error(insertRes.error?.message ?? "Failed to publish event");
  }

  const updatePayload = pickExistingColumns(
    {
      moderation_status: "approved",
      moderation_reason: "Одобрено модератором в Telegram",
      moderated_by: moderatorUserId,
      moderated_at: new Date().toISOString(),
      published_event_id: insertRes.data.id,
      updated_at: new Date().toISOString(),
    },
    subCols,
  );

  await supabaseAdmin.from("event_submissions").update(updatePayload).eq("id", submission.id);

  return String(insertRes.data.id);
}

async function handleModerationCallback(payload: any) {
  const callback = payload?.callback_query;
  if (!callback) return false;

  const data = String(callback.data ?? "");
  const chatId = String(callback.message?.chat?.id ?? "");
  const callbackId = String(callback.id ?? "");
  const tgUserId = String(callback.from?.id ?? "");

  const match = data.match(/^eventmod:(approve|reject|need_info):([0-9a-fA-F-]{36})$/);
  if (!match) {
    await answerCallbackQuery(callbackId, "Неизвестная команда");
    return true;
  }

  const action = match[1] as ModerationAction;
  const submissionId = match[2];

  const [{ data: submission }, actor] = await Promise.all([
    supabaseAdmin.from("event_submissions").select("*").eq("id", submissionId).maybeSingle(),
    resolveAdminByTelegram(tgUserId),
  ]);

  if (!submission) {
    await answerCallbackQuery(callbackId, "Заявка не найдена");
    await sendTelegramMessage(chatId, `⚠️ Заявка <code>${submissionId}</code> не найдена`);
    return true;
  }

  if (!actor.canModerate) {
    await answerCallbackQuery(callbackId, "Нет прав");
    await sendTelegramMessage(chatId, "⛔ У тебя нет прав модерации");
    return true;
  }

  try {
    if (action === "approve") {
      const eventId = await publishSubmission(submission, actor.adminUserId);
      await logSubmissionAction({
        submissionId,
        action: "approve",
        actorUserId: actor.adminUserId,
        note: "Approved via Telegram callback",
        payload: { eventId, telegramUserId: tgUserId },
      });

      await answerCallbackQuery(callbackId, "Одобрено");
      await sendTelegramMessage(chatId, `✅ Заявка <code>${submissionId}</code> одобрена и опубликована как событие <code>${eventId}</code>`);
      return true;
    }

    const status = action === "reject" ? "rejected" : "need_info";

    await supabaseAdmin
      .from("event_submissions")
      .update({
        moderation_status: status,
        moderation_reason: action === "reject" ? "Отклонено модератором" : "Нужны уточнения от автора",
        moderated_by: actor.adminUserId,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    await logSubmissionAction({
      submissionId,
      action,
      actorUserId: actor.adminUserId,
      note: `Set status ${status} via Telegram callback`,
      payload: { telegramUserId: tgUserId },
    });

    await answerCallbackQuery(callbackId, action === "reject" ? "Отклонено" : "Запрошено уточнение");
    await sendTelegramMessage(
      chatId,
      action === "reject"
        ? `❌ Заявка <code>${submissionId}</code> отклонена`
        : `🟨 По заявке <code>${submissionId}</code> запрошено уточнение`,
    );
  } catch (error) {
    await answerCallbackQuery(callbackId, "Ошибка обработки");
    await sendTelegramMessage(chatId, `⚠️ Ошибка обработки заявки <code>${submissionId}</code>: ${(error as Error).message}`);
  }

  return true;
}

async function handleVerificationMessage(payload: any) {
  const message = payload?.message;
  if (!message) return;

  const telegramUserId = String(message.from?.id ?? "");
  const chatId = String(message.chat?.id ?? telegramUserId);
  const text = String(message.text ?? "").trim();

  if (!text.startsWith("/start")) {
    await sendTelegramMessage(
      chatId,
      "Открой регистрацию в Meetap, введи номер и нажми подтверждение. Я пришлю код автоматически.",
    );
    return;
  }

  const token = text.split(" ")[1];

  if (!token) {
    await sendTelegramMessage(
      chatId,
      "Чтобы получить код, сначала введи номер в приложении Meetap и нажми подтверждение.",
    );
    return;
  }

  const { data: verification } = await supabaseAdmin
    .from("telegram_verifications")
    .select("id, phone, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!verification || verification.status !== "pending") {
    await sendTelegramMessage(chatId, "Токен не найден или уже использован. Запроси новый код в приложении.");
    return;
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("telegram_verifications").update({ status: "expired" }).eq("id", verification.id);

    await sendTelegramMessage(chatId, "Время кода вышло. Вернись в приложение и запроси код заново.");
    return;
  }

  await supabaseAdmin
    .from("telegram_verifications")
    .update({
      status: "verified",
      telegram_user_id: telegramUserId,
      verified_phone: verification.phone,
    })
    .eq("id", verification.id)
    .eq("status", "pending");

  const code = buildTelegramCode(token);

  await sendTelegramMessage(
    chatId,
    `Код для входа в Meetap: <b>${code}</b>\nДействует 10 минут. Введи его на шаге \"Код\".`,
  );
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);

    const handledModeration = await handleModerationCallback(payload);
    if (!handledModeration) {
      await handleVerificationMessage(payload);
    }

    return ok({ received: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Webhook error", 500);
  }
}
