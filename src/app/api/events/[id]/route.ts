import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { normalizeEventRow } from "@/server/events";
import { getPrimaryMediaMap } from "@/server/event-media";
import { updateEvent } from "@/server/events-service";

type EventMemberRow = {
  user_id: string;
  users: { id: string; name: string; avatar_url: string | null; interests?: string[] } | Array<{ id: string; name: string; avatar_url: string | null; interests?: string[] }> | null;
};

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  venue_name: z.string().trim().min(2).max(220).optional(),
  venue_address: z.string().trim().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  short_description: z.string().trim().min(10).max(320).optional(),
  full_description: z.string().trim().min(20).max(4000).optional(),
  is_free: z.boolean().optional(),
  price_text: z.string().trim().optional(),
  organizer_name: z.string().trim().optional(),
  organizer_telegram: z.string().trim().optional(),
  primary_media_id: z.string().uuid().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = getCurrentUserId();

  const schema = await getSchemaSnapshot(["events", "event_companion_requests"]);
  const eventsCols = asSet(schema, "events");
  const hasCompanionTable = (schema["event_companion_requests"] ?? []).length > 0;

  const eventSelect = [
    "id",
    "title",
    "description",
    "short_description",
    "full_description",
    "cover_url",
    "event_date",
    "starts_at",
    "ends_at",
    "price",
    "price_note",
    "city",
    "location",
    "venue_name",
    "venue_address",
    "category",
    "source_kind",
    "external_source",
    "external_url",
    "organizer_telegram",
    "social_mode",
    "participant_limit",
    "looking_for_count",
    "submission_id",
    "status",
    "moderation_status",
    "source_meta",
    "is_paid",
    "payment_url",
    "payment_note",
  ].filter((x) => eventsCols.has(x));

  const { data: rawEvent } = await supabaseAdmin.from("events").select(eventSelect.join(",")).eq("id", params.id).single();

  if (!rawEvent) {
    return fail("Event not found", 404);
  }

  const normalized = normalizeEventRow(rawEvent);
  const mediaMap = await getPrimaryMediaMap([params.id]);
  const mediaUrl = mediaMap.get(params.id);
  if (mediaUrl) normalized.cover_url = mediaUrl;

  const [participantsRes, myMembershipRes, companionRowsRes] = await Promise.all([
    supabaseAdmin.from("event_members").select("user_id,users(id,name,avatar_url,interests)").eq("event_id", params.id),
    userId
      ? supabaseAdmin.from("event_members").select("id").eq("event_id", params.id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    hasCompanionTable
      ? supabaseAdmin.from("event_companion_requests").select("event_id,user_id,status").eq("event_id", params.id).eq("status", "active")
      : Promise.resolve({ data: [] as Array<{ event_id: string; user_id: string; status: string }> }),
  ]);

  const participants = (participantsRes.data ?? []) as EventMemberRow[];
  const companionRows = companionRowsRes.data ?? [];

  if (userId) {
    await trackEvent({
      eventName: "events.viewed",
      userId,
      path: `/events/${params.id}`,
      properties: { eventId: params.id, source: normalizeEventRow(rawEvent).source_kind },
    });
  }

  return ok({
    event: normalized,
    participants,
    joined: Boolean(myMembershipRes?.data && (myMembershipRes.data as any).id),
    going_count: participants.length,
    companion_count: companionRows.length,
    looking_company: Boolean(userId && companionRows.some((x: any) => x.user_id === userId)),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    await updateEvent(params.id, parsed.data);
    return ok({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось обновить событие", 500);
  }
}

