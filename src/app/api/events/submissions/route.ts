import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { normalizeTelegramContact, sendEventSubmissionToTelegramModerationBot } from "@/server/telegram-moderation";
import { trackEvent } from "@/server/analytics";
import { busyResponse, checkRateLimit, clientKeyFromRequest, withConcurrencyLimit } from "@/server/runtime-guard";


function normalizePhoneValue(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  let num = digits;
  if (num.length === 10) num = `7${num}`;
  if (num.length === 11 && num.startsWith("8")) num = `7${num.slice(1)}`;
  if (num.length === 12 && (num.startsWith("7") || num.startsWith("8"))) num = num.slice(1);
  if (num.length !== 11) return null;
  if (!num.startsWith("7")) return null;
  return `+${num}`;
}

const schema = z
  .object({
    title: z.string().trim().min(3).max(120),
    category: z.string().trim().min(2).max(80),
    short_description: z.string().trim().min(10).max(320),
    full_description: z.string().trim().min(20).max(4000),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(3).max(220),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().nullable().optional(),
    cover_urls: z.array(z.string().url()).min(0).max(8).optional().default([]),
    format: z.enum(["organize", "looking", "group"]).optional(),
    mode: z.enum(["organize", "looking_company", "collect_group"]).optional(),
    is_paid: z.boolean(),
    price: z.number().min(0).nullable().optional(),
    payment_url: z.string().url().nullable().optional(),
    payment_note: z.string().trim().max(500).nullable().optional(),
    telegram_contact: z.string().trim().min(3).max(80),
    event_id: z.string().uuid().optional(),
    participant_limit: z.number().int().min(1).max(5000).nullable().optional(),
    looking_for_count: z.number().int().min(1).max(5000).nullable().optional(),
    moderator_comment: z.string().trim().max(600).nullable().optional(),
    trust_confirmed: z.boolean(),
    organizer_name: z.string().trim().min(2).max(120).optional(),
    organizer_phone: z.string().trim().min(6).max(40),
    organizer_fee_confirmed: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.trust_confirmed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Подтверди, что событие реальное и не мошенническое", path: ["trust_confirmed"] });
    }


    const starts = new Date(data.starts_at);
    if (!Number.isFinite(starts.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная дата начала", path: ["starts_at"] });
    } else if (starts.getTime() < Date.now() - 5 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Дата начала в прошлом", path: ["starts_at"] });
    }
    if (data.ends_at) {
      const ends = new Date(data.ends_at);
      if (!Number.isFinite(ends.getTime()) || ends.getTime() <= starts.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Дата окончания должна быть позже начала", path: ["ends_at"] });
      }
    }

    if (data.city.trim() !== "Москва") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Пока доступен только город Москва", path: ["city"] });
    }
    const normalizedPhone = normalizePhoneValue(data.organizer_phone);
    if (!normalizedPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Телефон: формат 7/8/+7/+8", path: ["organizer_phone"] });
    }

    if (!data.organizer_fee_confirmed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Подтверди оплату оргвзноса 100 ₽", path: ["organizer_fee_confirmed"] });
    }
    if (data.is_paid) {
      const hasPrice = Number(data.price ?? 0) > 0 || Boolean(data.payment_note?.trim());
      const hasPayment = Boolean(data.payment_url);
      if (!hasPrice && !hasPayment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для платного события укажи цену или способ оплаты",
          path: ["price"],
        });
      }
    }
  });

export async function POST(req: Request) {
  const userId = requireUserId();
  const rate = checkRateLimit(`event-submission:${clientKeyFromRequest(req, userId)}`, 8, 60_000);
  if (!rate.ok) {
    return fail("Слишком много отправок. Попробуй через минуту.", 429, {
      code: "RATE_LIMIT",
      endpoint: "/api/events/submissions",
      hint: `Повтори через ${rate.retryAfterSec} сек`,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422, { code: "VALIDATION" });
  }

  const resolvedMode = parsed.data.mode ?? (parsed.data.format === "looking" ? "looking_company" : parsed.data.format === "group" ? "collect_group" : parsed.data.format === "organize" ? "organize" : undefined);
  if (!resolvedMode) {
    return fail("Укажи формат события", 422, { code: "VALIDATION", fields: ["Формат"] });
  }
  const resolvedFormat = resolvedMode === "looking_company" ? "looking" : resolvedMode === "collect_group" ? "group" : "organize";
  const safeFormat = resolvedFormat || "organize";

  const tg = normalizeTelegramContact(parsed.data.telegram_contact);
  if (!tg) {
    return fail("Укажи Telegram в формате @username или https://t.me/username", 422, { code: "VALIDATION" });
  }

  try {
    return await withConcurrencyLimit("events:submission", 4, async () => {
      const schemaSnapshot = await getSchemaSnapshot(["event_submissions", "users"]);
      const submissionCols = asSet(schemaSnapshot, "event_submissions");

      if (!submissionCols.size) {
        return fail("Таблица заявок событий не найдена", 500, {
          code: "DB",
          hint: "Примени миграцию 024_event_submissions_hotfix.sql",
        });
      }

      const insertCandidate = {
        creator_user_id: userId,
        event_id: parsed.data.event_id ?? null,
        user_id: userId,
        title: parsed.data.title,
        category: parsed.data.category,
        format: safeFormat,
        short_description: parsed.data.short_description,
        full_description: parsed.data.full_description,
        city: parsed.data.city,
        address: parsed.data.address,
        venue: parsed.data.address,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at ?? null,
        cover_urls: parsed.data.cover_urls ?? [],
        cover_image_url: parsed.data.cover_urls?.[0] ?? null,
        mode: resolvedMode,
        is_paid: parsed.data.is_paid,
        price: parsed.data.price ?? null,
        price_text: parsed.data.payment_note ?? null,
        payment_url: parsed.data.payment_url ?? null,
        payment_note: parsed.data.payment_note ?? null,
        telegram_contact: tg,
        organizer_telegram: tg,
        organizer_name: parsed.data.organizer_name ?? null,
        organizer_phone: normalizePhoneValue(parsed.data.organizer_phone) ?? parsed.data.organizer_phone ?? null,
        participant_limit: parsed.data.participant_limit ?? null,
        looking_for_count: parsed.data.looking_for_count ?? null,
        moderator_comment: parsed.data.moderator_comment ?? null,
        trust_confirmed: parsed.data.trust_confirmed,
        moderation_status: "pending",
        status: "pending_review",
        metadata: { source: "app", version: "events-v3", organizer_fee_confirmed: Boolean(parsed.data.organizer_fee_confirmed) },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const insertPayload = pickExistingColumns(insertCandidate, submissionCols);

      const ins = await supabaseAdmin.from("event_submissions").insert(insertPayload).select("id").single();
      if (ins.error || !ins.data?.id) {
        return fail(ins.error?.message ?? "Failed to save submission", 500, { code: "DB" });
      }

      const { data: user } = await supabaseAdmin.from("users").select("id,name").eq("id", userId).maybeSingle();

      const tgResult = await sendEventSubmissionToTelegramModerationBot({
        id: ins.data.id,
        title: parsed.data.title,
        category: parsed.data.category,
        city: parsed.data.city,
        address: parsed.data.address,
        startsAt: parsed.data.starts_at,
        endsAt: parsed.data.ends_at,
        mode: resolvedMode,
        isPaid: parsed.data.is_paid,
        price: parsed.data.price,
        paymentUrl: parsed.data.payment_url,
        paymentNote: parsed.data.payment_note,
        telegramContact: tg,
        organizerPhone: parsed.data.organizer_phone,
        shortDescription: parsed.data.short_description,
        fullDescription: parsed.data.full_description,
        coverUrls: parsed.data.cover_urls ?? [],
        userId,
        userName: user?.name ?? null,
      });

      await trackEvent({
        eventName: "events.submission_created",
        userId,
        path: "/events/new/create",
        properties: {
          submissionId: ins.data.id,
          mode: resolvedMode,
          category: parsed.data.category,
          isPaid: parsed.data.is_paid,
          telegram: tg,
          botDelivered: tgResult.ok,
        },
      });

      return ok({ ok: true, submission_id: ins.data.id, moderation_status: "pending", bot: tgResult });
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BUSY:")) {
      return busyResponse("/api/events/submissions");
    }

    return fail(error instanceof Error ? error.message : "Submission failed", 500, {
      code: "DB",
      endpoint: "/api/events/submissions",
      hint: "Проверь логи сервера и статус БД",
    });
  }
}
