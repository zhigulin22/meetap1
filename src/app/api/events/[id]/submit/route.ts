import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { updateEvent } from "@/server/events-service";
import { normalizeTelegramContact, sendEventSubmissionToTelegramModerationBot } from "@/server/telegram-moderation";
import { checkRateLimit, clientKeyFromRequest } from "@/server/runtime-guard";

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  title: "Название",
  category: "Категория",
  city: "Город",
  starts_at: "Дата",
  short_description: "Короткое описание",
  full_description: "Полное описание",
  organizer_telegram: "Telegram организатора",
  organizer_phone: "Телефон организатора",
  venue: "Место",
};

const REQUIRE_ORGANIZER_FEE = true;
const ORGANIZER_FEE_RUB = 100;

async function getPrimaryMediaUrl(eventId: string) {
  const { data } = await supabaseAdmin
    .from("event_media")
    .select("storage_bucket,storage_path,is_primary")
    .eq("event_id", eventId)
    .order("is_primary", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.storage_bucket || !row?.storage_path) return null;
  return supabaseAdmin.storage.from(row.storage_bucket).getPublicUrl(row.storage_path).data.publicUrl;
}

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


type SubmitBody = {
  title?: string;
  category?: string;
  city?: string;
  venue_name?: string;
  venue_address?: string;
  starts_at?: string;
  ends_at?: string | null;
  short_description?: string;
  full_description?: string;
  organizer_telegram?: string;
  organizer_phone?: string;
  organizer_name?: string;
  organizer_fee_confirmed?: boolean;
  organizer_fee_payment_id?: string;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
    const rate = checkRateLimit(`event-submit:${clientKeyFromRequest(req, userId)}`, 4, 60 * 60 * 1000);
    if (!rate.ok) {
      return fail("Слишком много заявок. Попробуй позже.", 429, {
        code: "RATE_LIMIT",
        hint: `Повтори через ${rate.retryAfterSec} сек`,
      });
    }
    const body = (await req.json().catch(() => null)) as SubmitBody | null;

    const snapshot = await getSchemaSnapshot(["events", "event_submissions"]);
    const eventCols = asSet(snapshot, "events");
    const submissionCols = asSet(snapshot, "event_submissions");

    if (!eventCols.size || !submissionCols.size) {
      return fail("Сервис модерации не готов", 500, {
        code: "DB",
        hint: "Проверь миграции events/event_submissions",
      });
    }

    const selectCols = [
      "id",
      "title",
      "category",
      "city",
      "venue_name",
      "venue_address",
      "starts_at",
      "ends_at",
      "short_description",
      "full_description",
      "organizer_telegram",
      "organizer_phone",
      "organizer_name",
      "social_mode",
      "is_paid",
      "price_text",
      "payment_url",
      "payment_note",
      "cover_url",
      "image_url",
      "created_by_user_id",
      "creator_user_id",
    ].filter((c) => eventCols.has(c));

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select(selectCols.join(","))
      .eq("id", params.id)
      .single();
    if (error || !event) return fail("Событие не найдено", 404);

    const ownerId = (event as any).created_by_user_id ?? (event as any).creator_user_id ?? null;
    const primaryMediaUrl = (event as any).cover_url || (event as any).image_url || (await getPrimaryMediaUrl(params.id));
    const coverUrls = [primaryMediaUrl].filter(Boolean) as string[];
    if (ownerId && String(ownerId) !== String(userId)) {
      return fail("Нет доступа", 403);
    }

    const merged = {
      title: (event as any).title ?? body?.title ?? "",
      category: (event as any).category ?? body?.category ?? "",
      city: (event as any).city ?? body?.city ?? "",
      venue_name: (event as any).venue_name ?? body?.venue_name ?? "",
      venue_address: (event as any).venue_address ?? body?.venue_address ?? "",
      starts_at: (event as any).starts_at ?? body?.starts_at ?? "",
      ends_at: (event as any).ends_at ?? body?.ends_at ?? null,
      short_description: (event as any).short_description ?? body?.short_description ?? "",
      full_description: (event as any).full_description ?? body?.full_description ?? "",
      organizer_telegram: body?.organizer_telegram ?? (event as any).organizer_telegram ?? "",
      organizer_phone: body?.organizer_phone ?? (event as any).organizer_phone ?? "",
      organizer_name: body?.organizer_name ?? (event as any).organizer_name ?? "",
    };

    const format = (event as any).social_mode === "looking_company"
      ? "looking"
      : (event as any).social_mode === "collect_group"
        ? "group"
        : "organize";

    const safeFormat = format || "organize";

    const missing: string[] = [];
    if (!merged.title) missing.push(REQUIRED_FIELD_LABELS.title);
    if (!merged.category) missing.push(REQUIRED_FIELD_LABELS.category);
    if (!merged.city) missing.push(REQUIRED_FIELD_LABELS.city);
    if (!merged.starts_at) missing.push(REQUIRED_FIELD_LABELS.starts_at);
    if (!merged.short_description) missing.push(REQUIRED_FIELD_LABELS.short_description);
    if (!merged.full_description) missing.push(REQUIRED_FIELD_LABELS.full_description);
    if (!merged.organizer_telegram) missing.push(REQUIRED_FIELD_LABELS.organizer_telegram);
    if (!merged.organizer_phone) missing.push(REQUIRED_FIELD_LABELS.organizer_phone);
    if (!merged.venue_name && !merged.venue_address) missing.push(REQUIRED_FIELD_LABELS.venue);

    if (missing.length) {
      return fail(`Не заполнены обязательные поля: ${missing.join(", ")}`, 422, {
        code: "VALIDATION",
        fields: missing,
      });
    }

    const normalizedTelegram = normalizeTelegramContact(merged.organizer_telegram);
    const normalizedPhone = normalizePhoneValue(merged.organizer_phone);
    if (!normalizedPhone) {
      return fail("Телефон организатора: формат 7/8/+7/+8", 422, {
        code: "VALIDATION",
        fields: [REQUIRED_FIELD_LABELS.organizer_phone],
      });
    }

    if (merged.city.trim() !== "Москва") {
      return fail("Пока доступен только город Москва", 422, {
        code: "VALIDATION",
        fields: [REQUIRED_FIELD_LABELS.city],
      });
    }

    const startsAt = new Date(merged.starts_at);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() - 5 * 60 * 1000) {
      return fail("Дата начала должна быть в будущем", 422, {
        code: "VALIDATION",
        fields: [REQUIRED_FIELD_LABELS.starts_at],
      });
    }
    if (merged.ends_at) {
      const endsAt = new Date(merged.ends_at);
      if (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
        return fail("Дата окончания должна быть позже начала", 422, {
          code: "VALIDATION",
          fields: [REQUIRED_FIELD_LABELS.starts_at],
        });
      }
    }
    if (!normalizedTelegram) {
      return fail("Укажи Telegram организатора в формате @username или https://t.me/username", 422, {
        code: "VALIDATION",
        fields: [REQUIRED_FIELD_LABELS.organizer_telegram],
      });
    }

    if (REQUIRE_ORGANIZER_FEE && !body?.organizer_fee_confirmed) {
      return fail(`Нужно подтвердить оплату оргвзноса ${ORGANIZER_FEE_RUB} ₽`, 422, {
        code: "VALIDATION",
        fields: ["Оргвзнос"],
      });
    }

    const existing = await supabaseAdmin
      .from("event_submissions")
      .select("id,status")
      .eq("event_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) {
      await updateEvent(params.id, { status: "pending_review", moderation_status: "pending" });
      const sendRes = await sendEventSubmissionToTelegramModerationBot({
        id: existing.data.id,
        title: merged.title,
        category: merged.category,
        city: merged.city,
        address: merged.venue_address || merged.venue_name,
        startsAt: merged.starts_at,
        endsAt: merged.ends_at ?? null,
        mode: (event as any).social_mode ?? "organize",
        isPaid: Boolean((event as any).is_paid),
        price: null,
        paymentUrl: (event as any).payment_url ?? null,
        paymentNote: (event as any).payment_note ?? null,
        telegramContact: normalizedTelegram,
        organizerPhone: normalizedPhone || null,
        shortDescription: merged.short_description,
        fullDescription: merged.full_description,
        coverUrls: coverUrls,
        userId,
      });

      if (!sendRes.ok) {
        return fail("Заявка сохранена, но не доставлена модераторам", 502, {
          code: "TELEGRAM",
          hint: sendRes.reason ?? "unknown",
        });
      }

      return ok({ ok: true, submission_id: existing.data.id, already_exists: true, bot: { ok: true } });
    }

    const payload = pickExistingColumns(
      {
        creator_user_id: userId,
        user_id: userId,
        event_id: params.id,
        title: merged.title,
        format: safeFormat,
        mode: safeFormat,
        category: merged.category,
        city: merged.city,
        venue: merged.venue_name || null,
        address: merged.venue_address || null,
        starts_at: merged.starts_at,
        ends_at: merged.ends_at ?? null,
        short_description: merged.short_description,
        full_description: merged.full_description,
        organizer_telegram: normalizedTelegram,
        organizer_phone: normalizedPhone || null,
        organizer_name: merged.organizer_name || null,
        is_paid: Boolean((event as any).is_paid),
        price_text: (event as any).price_text ?? null,
        payment_url: (event as any).payment_url ?? null,
        payment_note: (event as any).payment_note ?? null,
        cover_urls: coverUrls,
        cover_image_url: coverUrls[0] ?? null,
        status: "pending_review",
        moderation_status: "pending",
        trust_confirmed: true,
        metadata: { source: "event-submit", event_id: params.id, organizer_fee_confirmed: Boolean(body?.organizer_fee_confirmed), organizer_fee_payment_id: body?.organizer_fee_payment_id ?? null },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      submissionCols,
    );

    const ins = await supabaseAdmin.from("event_submissions").insert(payload).select("id").single();
    if (ins.error || !ins.data?.id) {
      return fail(ins.error?.message ?? "Не удалось создать заявку", 500);
    }

    await updateEvent(params.id, { status: "pending_review", moderation_status: "pending" });

    const sendRes = await sendEventSubmissionToTelegramModerationBot({
      id: ins.data.id,
      title: merged.title,
      category: merged.category,
      city: merged.city,
      address: merged.venue_address || merged.venue_name,
      startsAt: merged.starts_at,
      endsAt: merged.ends_at ?? null,
      mode: (event as any).social_mode ?? "organize",
      isPaid: Boolean((event as any).is_paid),
      price: null,
      paymentUrl: (event as any).payment_url ?? null,
      paymentNote: (event as any).payment_note ?? null,
      telegramContact: normalizedTelegram,
      organizerPhone: normalizedPhone || null,
      shortDescription: merged.short_description,
      fullDescription: merged.full_description,
      coverUrls: coverUrls,
      userId,
    });

    if (!sendRes.ok) {
      return fail("Заявка сохранена, но не доставлена модераторам", 502, {
        code: "TELEGRAM",
        hint: sendRes.reason ?? "unknown",
      });
    }

    return ok({ ok: true, submission_id: ins.data.id, bot: { ok: true } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось отправить", 500);
  }
}
