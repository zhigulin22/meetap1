import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { updateEvent } from "@/server/events-service";
import { normalizeTelegramContact, sendEventSubmissionToTelegramModerationBot } from "@/server/telegram-moderation";

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  title: "Название",
  category: "Категория",
  city: "Город",
  starts_at: "Дата",
  short_description: "Короткое описание",
  full_description: "Полное описание",
  organizer_telegram: "Telegram организатора",
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
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
    if (ownerId && String(ownerId) !== String(userId)) {
      return fail("Нет доступа", 403);
    }

    const missing: string[] = [];
    if (eventCols.has("title") && !(event as any).title) missing.push(REQUIRED_FIELD_LABELS.title);
    if (eventCols.has("category") && !(event as any).category) missing.push(REQUIRED_FIELD_LABELS.category);
    if (eventCols.has("city") && !(event as any).city) missing.push(REQUIRED_FIELD_LABELS.city);
    if (eventCols.has("starts_at") && !(event as any).starts_at) missing.push(REQUIRED_FIELD_LABELS.starts_at);
    if (eventCols.has("short_description") && !(event as any).short_description)
      missing.push(REQUIRED_FIELD_LABELS.short_description);
    if (eventCols.has("full_description") && !(event as any).full_description)
      missing.push(REQUIRED_FIELD_LABELS.full_description);

    const hasVenueCol = eventCols.has("venue_name") || eventCols.has("venue_address");
    if (hasVenueCol && !(event as any).venue_name && !(event as any).venue_address) {
      missing.push("Место");
    }

    if (eventCols.has("organizer_telegram") && !(event as any).organizer_telegram) {
      missing.push(REQUIRED_FIELD_LABELS.organizer_telegram);
    }

    if (missing.length) {
      return fail(`Не заполнены обязательные поля: ${missing.join(", ")}`, 422, {
        code: "VALIDATION",
        fields: missing,
      });
    }

    const normalizedTelegram = normalizeTelegramContact((event as any).organizer_telegram ?? "");
    if (!normalizedTelegram) {
      return fail("Укажи Telegram организатора в формате @username или https://t.me/username", 422, {
        code: "VALIDATION",
        fields: [REQUIRED_FIELD_LABELS.organizer_telegram],
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
        title: (event as any).title,
        category: (event as any).category,
        city: (event as any).city,
        address: (event as any).venue_address ?? (event as any).venue_name ?? "",
        startsAt: (event as any).starts_at,
        endsAt: (event as any).ends_at ?? null,
        mode: (event as any).social_mode ?? "organize",
        isPaid: Boolean((event as any).is_paid),
        price: null,
        paymentUrl: (event as any).payment_url ?? null,
        paymentNote: (event as any).payment_note ?? null,
        telegramContact: normalizedTelegram,
        shortDescription: (event as any).short_description,
        fullDescription: (event as any).full_description,
        coverUrls: [(event as any).cover_url ?? (event as any).image_url].filter(Boolean) as string[],
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
        title: (event as any).title,
        category: (event as any).category,
        city: (event as any).city,
        venue: (event as any).venue_name ?? null,
        address: (event as any).venue_address ?? null,
        starts_at: (event as any).starts_at,
        ends_at: (event as any).ends_at ?? null,
        short_description: (event as any).short_description,
        full_description: (event as any).full_description,
        organizer_telegram: normalizedTelegram,
        organizer_name: (event as any).organizer_name ?? null,
        is_paid: Boolean((event as any).is_paid),
        price_text: (event as any).price_text ?? null,
        payment_url: (event as any).payment_url ?? null,
        payment_note: (event as any).payment_note ?? null,
        status: "pending_review",
        moderation_status: "pending",
        trust_confirmed: true,
        metadata: { source: "event-submit", event_id: params.id },
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
      title: (event as any).title,
      category: (event as any).category,
      city: (event as any).city,
      address: (event as any).venue_address ?? (event as any).venue_name ?? "",
      startsAt: (event as any).starts_at,
      endsAt: (event as any).ends_at ?? null,
      mode: (event as any).social_mode ?? "organize",
      isPaid: Boolean((event as any).is_paid),
      price: null,
      paymentUrl: (event as any).payment_url ?? null,
      paymentNote: (event as any).payment_note ?? null,
      telegramContact: normalizedTelegram,
      shortDescription: (event as any).short_description,
      fullDescription: (event as any).full_description,
      coverUrls: [(event as any).cover_url ?? (event as any).image_url].filter(Boolean) as string[],
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
