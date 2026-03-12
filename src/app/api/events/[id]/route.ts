import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { normalizeEventRow } from "@/server/events";

type EventMemberRow = {
  user_id: string;
  users: { id: string; name: string; avatar_url: string | null; interests?: string[] } | Array<{ id: string; name: string; avatar_url: string | null; interests?: string[] }> | null;
};

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
    event: normalizeEventRow(rawEvent),
    participants,
    joined: Boolean(myMembershipRes?.data && (myMembershipRes.data as any).id),
    going_count: participants.length,
    companion_count: companionRows.length,
    looking_company: Boolean(userId && companionRows.some((x: any) => x.user_id === userId)),
  });
}
