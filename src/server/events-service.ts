import "server-only";

import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { normalizeEventRow } from "@/server/events";

export type EventCreateInput = {
  title: string;
  category: string;
  city: string;
  venue_name: string;
  venue_address?: string | null;
  starts_at: string;
  ends_at?: string | null;
  short_description: string;
  full_description: string;
  is_free?: boolean;
  price_text?: string | null;
  organizer_name?: string | null;
  organizer_telegram?: string | null;
};

export async function createEvent(input: EventCreateInput, userId: string) {
  const schemaSnapshot = await getSchemaSnapshot(["events"]);
  const eventsCols = asSet(schemaSnapshot, "events");

  const insertCandidate = {
    title: input.title,
    category: input.category,
    city: input.city,
    venue_name: input.venue_name,
    venue_address: input.venue_address ?? null,
    location: input.venue_name,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    short_description: input.short_description,
    full_description: input.full_description,
    description: input.short_description,
    description_short: input.short_description,
    description_full: input.full_description,
    event_date: input.starts_at,
    source_type: "community",
    source_kind: "community",
    status: "pending",
    moderation_status: "pending",
    is_paid: input.is_free === false,
    is_free: input.is_free !== false,
    price_text: input.price_text ?? null,
    organizer_name: input.organizer_name ?? null,
    organizer_telegram: input.organizer_telegram ?? null,
    created_by_user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const insertPayload = pickExistingColumns(insertCandidate, eventsCols);

  const { data, error } = await supabaseAdmin.from("events").insert(insertPayload).select("id").single();
  if (error || !data?.id) throw new Error(error?.message ?? "Не удалось создать событие");

  return String(data.id);
}

export type EventUpdateInput = Partial<EventCreateInput> & {
  status?: string;
  moderation_status?: string;
  primary_media_id?: string | null;
};

export async function updateEvent(eventId: string, input: EventUpdateInput) {
  const schemaSnapshot = await getSchemaSnapshot(["events"]);
  const eventsCols = asSet(schemaSnapshot, "events");

  const updateCandidate = {
    title: input.title,
    category: input.category,
    city: input.city,
    venue_name: input.venue_name,
    venue_address: input.venue_address,
    location: input.venue_name,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    short_description: input.short_description,
    full_description: input.full_description,
    description: input.short_description,
    description_short: input.short_description,
    description_full: input.full_description,
    status: input.status,
    moderation_status: input.moderation_status,
    price_text: input.price_text,
    is_paid: input.is_free === false ? true : input.is_free === true ? false : undefined,
    is_free: input.is_free,
    organizer_name: input.organizer_name,
    organizer_telegram: input.organizer_telegram,
    primary_media_id: input.primary_media_id,
    updated_at: new Date().toISOString(),
  };

  const payload = pickExistingColumns(updateCandidate, eventsCols);
  if (!Object.keys(payload).length) return;

  const { error } = await supabaseAdmin.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function getEventById(eventId: string) {
  const { data, error } = await supabaseAdmin.from("events").select("*").eq("id", eventId).single();
  if (error || !data) throw new Error(error?.message ?? "Event not found");
  return normalizeEventRow(data);
}

export async function listEvents(limit = 20, offset = 0) {
  const { data, error } = await supabaseAdmin.from("events").select("*").range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeEventRow);
}

