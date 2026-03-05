import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { normalizeTelegramContact, sendEventSubmissionToTelegramModerationBot } from "@/server/telegram-moderation";
import { trackEvent } from "@/server/analytics";

const schema = z
  .object({
    title: z.string().trim().min(3).max(120),
    category: z.string().trim().min(2).max(80),
    short_description: z.string().trim().min(12).max(320),
    full_description: z.string().trim().min(40).max(4000),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(3).max(220),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().nullable().optional(),
    cover_urls: z.array(z.string().url()).min(1).max(8),
    mode: z.enum(["organize", "looking_company", "collect_group"]),
    is_paid: z.boolean(),
    price: z.number().min(0).nullable().optional(),
    payment_url: z.string().url().nullable().optional(),
    payment_note: z.string().trim().max(500).nullable().optional(),
    telegram_contact: z.string().trim().min(5).max(80),
    participant_limit: z.number().int().min(1).max(5000).nullable().optional(),
    looking_for_count: z.number().int().min(1).max(5000).nullable().optional(),
    moderator_comment: z.string().trim().max(600).nullable().optional(),
    trust_confirmed: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.trust_confirmed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Подтверди, что событие реальное и не мошенническое", path: ["trust_confirmed"] });
    }

    if (data.is_paid) {
      const hasPrice = Number(data.price ?? 0) > 0;
      const hasPayment = Boolean(data.payment_url || data.payment_note);
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
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422, { code: "VALIDATION" });
    }

    const tg = normalizeTelegramContact(parsed.data.telegram_contact);
    if (!tg) {
      return fail("Укажи Telegram в формате @username или https://t.me/username", 422, { code: "VALIDATION" });
    }

    const schemaSnapshot = await getSchemaSnapshot(["event_submissions", "users"]);
    const submissionCols = asSet(schemaSnapshot, "event_submissions");

    if (!submissionCols.size) {
      return fail("Таблица заявок событий не найдена", 500, {
        code: "DB",
        hint: "Примени миграцию 021_events_experience_revamp.sql",
      });
    }

    const insertCandidate = {
      creator_user_id: userId,
      title: parsed.data.title,
      category: parsed.data.category,
      short_description: parsed.data.short_description,
      full_description: parsed.data.full_description,
      city: parsed.data.city,
      address: parsed.data.address,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at ?? null,
      cover_urls: parsed.data.cover_urls,
      mode: parsed.data.mode,
      is_paid: parsed.data.is_paid,
      price: parsed.data.price ?? null,
      payment_url: parsed.data.payment_url ?? null,
      payment_note: parsed.data.payment_note ?? null,
      telegram_contact: tg,
      participant_limit: parsed.data.participant_limit ?? null,
      looking_for_count: parsed.data.looking_for_count ?? null,
      moderator_comment: parsed.data.moderator_comment ?? null,
      trust_confirmed: parsed.data.trust_confirmed,
      moderation_status: "pending",
      metadata: { source: "app", version: "events-v2" },
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
      mode: parsed.data.mode,
      isPaid: parsed.data.is_paid,
      price: parsed.data.price,
      paymentUrl: parsed.data.payment_url,
      paymentNote: parsed.data.payment_note,
      telegramContact: tg,
      shortDescription: parsed.data.short_description,
      fullDescription: parsed.data.full_description,
      coverUrls: parsed.data.cover_urls,
      userId,
      userName: user?.name ?? null,
    });

    await trackEvent({
      eventName: "events.submission_created",
      userId,
      path: "/events",
      properties: {
        submissionId: ins.data.id,
        mode: parsed.data.mode,
        category: parsed.data.category,
        isPaid: parsed.data.is_paid,
        telegram: tg,
        botDelivered: tgResult.ok,
      },
    });

    return ok({ ok: true, submission_id: ins.data.id, moderation_status: "pending", bot: tgResult });
  } catch {
    return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
}
