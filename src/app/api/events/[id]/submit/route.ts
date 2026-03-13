import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { updateEvent } from "@/server/events-service";
import { normalizeTelegramContact, sendEventSubmissionToTelegramModerationBot } from "@/server/telegram-moderation";

const REQUIRED_FIELDS = ["title", "category", "city", "venue_name", "starts_at", "short_description", "full_description", "organizer_telegram"] as const;

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

    const { data: event, error } = await supabaseAdmin.from("events").select(selectCols.join(",")).eq("id", params.id).single();
    if (error || !event) return fail("Событие не найдено", 404);

    const ownerId = (event as any).created_by_user_id ?? (event as any).creator_user_id ?? null;
    if (ownerId && String(ownerId) !== String(userId)) {
      return fail("Нет доступа", 403);
    }

    for (const key of REQUIRED_FIELDS) {
      if (!(event as any)[key]) {
        return fail("Заполни обязательные поля перед отправкой", 422, {
          code: "VALIDATION",
          hint: `Поле ${key} обязательно для модерации`,
        });
      }
    }

    const normalizedTelegram = normalizeTelegramContact((event as any).organizer_telegram ?? "");
    if (!normalizedTelegram) {
      return fail("Укажи Telegram организатора в формате @username или https://t.me/username", 422, {
        code: "VALIDATION",
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
      await sendEventSubmissionToTelegramModerationBot({
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
      return ok({ ok: true, submission_id: existing.data.id, already_exists: true });
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
        status: "pending",
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

    await sendEventSubmissionToTelegramModerationBot({
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

    return ok({ ok: true, submission_id: ins.data.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось отправить", 500);
  }
}
