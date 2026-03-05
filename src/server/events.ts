import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";

export type EventListFilters = {
  feed: "all" | "external" | "community";
  category?: string;
  search?: string;
  city?: string;
  onlyUpcoming?: boolean;
};

export type EventProjection = {
  id: string;
  source_kind: "external" | "community";
  category: string;
  title: string;
  short_description: string;
  full_description: string;
  city: string;
  venue_name: string;
  venue_address: string;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  gallery: string[];
  is_paid: boolean;
  price: number;
  price_note: string | null;
  external_source: string | null;
  external_url: string | null;
  organizer_telegram: string | null;
  social_mode: string;
  participant_limit: number | null;
  looking_for_count: number | null;
  submission_id: string | null;
  status: string;
};

export async function getEventsColumns() {
  const snapshot = await getSchemaSnapshot(["events"]);
  return asSet(snapshot, "events");
}

function parseDate(input: string | null | undefined) {
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function toNum(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function toText(value: unknown, fallback = "") {
  const str = typeof value === "string" ? value.trim() : "";
  return str || fallback;
}

export function normalizeEventRow(row: any): EventProjection {
  const sourceRaw = toText(row?.source_type, toText(row?.source_kind, "external"));
  const sourceKind = sourceRaw === "community" ? "community" : "external";

  const startsAt =
    parseDate(row?.starts_at) ?? parseDate(row?.event_date) ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const gallery = Array.isArray(row?.source_meta?.gallery)
    ? row.source_meta.gallery.filter((x: any) => typeof x === "string")
    : [];

  const shortDescription =
    toText(row?.short_description, "") ||
    toText(row?.description_short, "") ||
    toText(row?.description, "");

  const fullDescription =
    toText(row?.full_description, "") ||
    toText(row?.description_full, "") ||
    toText(row?.description, "");

  const priceNote = toText(row?.price_note, "") || toText(row?.price_text, "") || null;
  const price =
    row?.price != null
      ? toNum(row.price, 0)
      : row?.price_min != null
        ? toNum(row.price_min, 0)
        : 0;

  return {
    id: String(row?.id ?? ""),
    source_kind: sourceKind,
    category: toText(row?.category, sourceKind === "community" ? "community" : "other"),
    title: toText(row?.title, "Без названия"),
    short_description: shortDescription,
    full_description: fullDescription || shortDescription,
    city: toText(row?.city, ""),
    venue_name: toText(row?.venue_name, toText(row?.location, "")),
    venue_address: toText(row?.venue_address, ""),
    starts_at: startsAt,
    ends_at: parseDate(row?.ends_at),
    cover_url:
      (typeof row?.cover_url === "string" && row.cover_url) ||
      (typeof row?.image_url === "string" && row.image_url) ||
      gallery[0] ||
      null,
    gallery,
    is_paid:
      typeof row?.is_paid === "boolean"
        ? row.is_paid
        : toNum(row?.price_min, 0) > 0 || toNum(row?.price, 0) > 0,
    price,
    price_note: priceNote,
    external_source: toText(row?.external_source, toText(row?.source_name, "")) || null,
    external_url: toText(row?.external_url, toText(row?.source_url, "")) || null,
    organizer_telegram: toText(row?.organizer_telegram, "") || null,
    social_mode: toText(row?.social_mode, sourceKind === "community" ? "organize" : "discover"),
    participant_limit: row?.participant_limit == null ? null : toNum(row.participant_limit),
    looking_for_count: row?.looking_for_count == null ? null : toNum(row.looking_for_count),
    submission_id: row?.submission_id ? String(row.submission_id) : null,
    status: toText(row?.status, toText(row?.moderation_status, "published")),
  };
}

export function mapSocialModeLabel(mode: string) {
  switch (mode) {
    case "looking_company":
      return "Ищу компанию";
    case "collect_group":
      return "Собираю группу";
    default:
      return "Организую";
  }
}

export async function buildEventInsertPayload(input: Record<string, unknown>) {
  const cols = await getEventsColumns();
  return pickExistingColumns(input, cols);
}
