import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { buildTelegramCode } from "@/lib/telegram-code";
import { getServerEnv, isPlaceholderEnvValue } from "@/lib/env";
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

function parseIdList(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  return raw
    .split(/[;,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
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

  const existingEventId = submission.event_id || submission.metadata?.event_id || null;

  if (existingEventId) {
    const updateEvent = pickExistingColumns(
      {
        status: "published",
        moderation_status: "approved",
        submission_id: submission.id,
        updated_at: new Date().toISOString(),
      },
      eventsCols,
    );

    await supabaseAdmin.from("events").update(updateEvent).eq("id", existingEventId);

    const updatePayload = pickExistingColumns(
      {
        moderation_status: "approved",
        moderation_reason: "Одобрено модератором в Telegram",
        moderated_by: moderatorUserId,
        moderated_at: new Date().toISOString(),
        published_event_id: existingEventId,
        updated_at: new Date().toISOString(),
      },
      subCols,
    );

    await supabaseAdmin.from("event_submissions").update(updatePayload).eq("id", submission.id);

    return String(existingEventId);
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
      moderation_status: "approved",
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

  const env = getServerEnv();
  const allowedIds = parseIdList(env.TELEGRAM_MODERATION_ADMIN_IDS);
  const allowedByEnv = allowedIds.includes(tgUserId);

  const [{ data: submission }, actor] = await Promise.all([
    supabaseAdmin.from("event_submissions").select("*").eq("id", submissionId).maybeSingle(),
    resolveAdminByTelegram(tgUserId),
  ]);

  if (!submission) {
    await answerCallbackQuery(callbackId, "Заявка не найдена");
    await sendTelegramMessage(chatId, `⚠️ Заявка <code>${submissionId}</code> не найдена`);
    return true;
  }

  if (!actor.canModerate && !allowedByEnv) {
    await answerCallbackQuery(callbackId, "Нет прав");
    await sendTelegramMessage(chatId, "⛔ У тебя нет прав модерации");
    return true;
  }

  const moderatorUserId = actor.adminUserId ?? null;

  try {
    if (action === "approve") {
      const eventId = await publishSubmission(submission, moderatorUserId);
      await logSubmissionAction({
        submissionId,
        action: "approve",
        actorUserId: moderatorUserId,
        note: "Approved via Telegram callback",
        payload: { eventId, telegramUserId: tgUserId },
      });

      await answerCallbackQuery(callbackId, "Одобрено");
      await sendTelegramMessage(chatId, `✅ Заявка <code>${submissionId}</code> одобрена и опубликована как событие <code>${eventId}</code>`);
      return true;
    }

    const status = action === "reject" ? "rejected" : "flagged";
    const nextEventStatus = action === "reject" ? "hidden" : "pending_review";

    await supabaseAdmin
      .from("event_submissions")
      .update({
        moderation_status: status,
        moderation_reason: action === "reject" ? "Отклонено модератором" : "Нужны уточнения от автора",
        moderated_by: moderatorUserId,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (submission.event_id) {
      await supabaseAdmin.from("events").update({ moderation_status: status, status: nextEventStatus, updated_at: new Date().toISOString() }).eq("id", submission.event_id);
    }

    await logSubmissionAction({
      submissionId,
      action,
      actorUserId: moderatorUserId,
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


async function handleStudentVerificationCallback(payload: any) {
  const callback = payload?.callback_query;
  if (!callback) return false;

  const data = String(callback.data ?? "");
  const chatId = String(callback.message?.chat?.id ?? "");
  const callbackId = String(callback.id ?? "");
  const tgUserId = String(callback.from?.id ?? "");

  const match = data.match(/^studentver:(approve|reject):([0-9a-fA-F-]{36})$/);
  if (!match) return false;

  const action = match[1] as ModerationAction;
  const verificationId = match[2];

  const env = getServerEnv();
  const allowedIds = parseIdList(env.TELEGRAM_MODERATION_ADMIN_IDS);
  const allowedByEnv = allowedIds.includes(tgUserId);

  const [{ data: verification }, actor, schema] = await Promise.all([
    supabaseAdmin.from("student_verifications").select("*").eq("id", verificationId).maybeSingle(),
    resolveAdminByTelegram(tgUserId),
    getSchemaSnapshot(["student_verifications", "users"]),
  ]);

  if (!verification) {
    await answerCallbackQuery(callbackId, "Заявка не найдена");
    await sendTelegramMessage(chatId, `⚠️ Заявка <code>${verificationId}</code> не найдена`);
    return true;
  }

  if (!actor.canModerate && !allowedByEnv) {
    await answerCallbackQuery(callbackId, "Нет прав");
    await sendTelegramMessage(chatId, "⛔ У тебя нет прав модерации");
    return true;
  }

  const verCols = asSet(schema, "student_verifications");
  const userCols = asSet(schema, "users");

  if (!verCols.size) {
    await answerCallbackQuery(callbackId, "Нет таблицы student_verifications");
    await sendTelegramMessage(chatId, "⚠️ Таблица student_verifications не найдена");
    return true;
  }

  const moderatorUserId = actor.adminUserId ?? null;
  const now = new Date().toISOString();

  try {
    if (action === "approve") {
      const updateVerification = pickExistingColumns(
        {
          status: "approved",
          reviewed_by: moderatorUserId,
          reviewed_at: now,
          updated_at: now,
        },
        verCols,
      );

      await supabaseAdmin.from("student_verifications").update(updateVerification).eq("id", verificationId);

      const updateUser = pickExistingColumns(
        {
          student_verified: true,
          student_verified_at: now,
          student_university: verification.university ?? null,
          student_verification_status: "approved",
        },
        userCols,
      );

      if (Object.keys(updateUser).length) {
        await supabaseAdmin.from("users").update(updateUser).eq("id", verification.user_id);
      }

      await answerCallbackQuery(callbackId, "Одобрено");
      await sendTelegramMessage(chatId, `✅ Студенческая верификация <code>${verificationId}</code> одобрена`);
      return true;
    }

    const updateVerification = pickExistingColumns(
      {
        status: "rejected",
        reviewed_by: moderatorUserId,
        reviewed_at: now,
        updated_at: now,
      },
      verCols,
    );

    await supabaseAdmin.from("student_verifications").update(updateVerification).eq("id", verificationId);

    const updateUser = pickExistingColumns(
      {
        student_verification_status: "rejected",
      },
      userCols,
    );

    if (Object.keys(updateUser).length) {
      await supabaseAdmin.from("users").update(updateUser).eq("id", verification.user_id);
    }

    await answerCallbackQuery(callbackId, "Отклонено");
    await sendTelegramMessage(chatId, `❌ Студенческая верификация <code>${verificationId}</code> отклонена`);
  } catch (error) {
    await answerCallbackQuery(callbackId, "Ошибка обработки");
    await sendTelegramMessage(chatId, `⚠️ Ошибка обработки заявки <code>${verificationId}</code>: ${(error as Error).message}`);
  }

  return true;
}

export async function POST(req: Request) {
  const env = getServerEnv();
  if (isPlaceholderEnvValue(env.TELEGRAM_BOT_TOKEN)) {
    return fail("Missing TELEGRAM_BOT_TOKEN", 500, { code: "MISSING_ENV" });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return fail("Invalid payload", 400);

  if (payload.callback_query) {
    const okHandled = (await handleModerationCallback(payload)) || (await handleStudentVerificationCallback(payload));
    return ok({ ok: okHandled });
  }

  const message = payload.message;
  if (!message) return ok({ ok: true });

  const chatId = String(message.chat?.id ?? "");
  const text = String(message.text ?? "");

  if (text.startsWith("/start ")) {
    const token = text.slice(7).trim();
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id,telegram_user_id")
      .eq("telegram_code", token)
      .maybeSingle();

    if (error || !user?.id) {
      await sendTelegramMessage(chatId, "Код не найден. Проверь в приложении.");
      return ok({ ok: true });
    }

    await supabaseAdmin.from("users").update({ telegram_user_id: message.from?.id }).eq("id", user.id);
    await sendTelegramMessage(chatId, "✅ Telegram привязан, теперь ты можешь модерировать события.");
    return ok({ ok: true });
  }

  if (text === "/help") {
    await sendTelegramMessage(chatId, "Доступные команды: /start <код>");
    return ok({ ok: true });
  }

  if (text === "/whoami") {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id,name,role")
      .eq("telegram_user_id", message.from?.id)
      .maybeSingle();

    if (!user) {
      await sendTelegramMessage(chatId, "Не найдено привязок к пользователю.");
      return ok({ ok: true });
    }

    await sendTelegramMessage(chatId, `Ваш профиль: ${user.name ?? "—"} (${user.role ?? "user"})`);
    return ok({ ok: true });
  }

  return ok({ ok: true });
}
