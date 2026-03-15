import "server-only";

import { randomUUID } from "crypto";
import { getServerEnv, isPlaceholderEnvValue } from "@/lib/env";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

type ImportCategoryKey = "sports" | "concerts" | "arts" | "quests" | "other";
type ProviderName = "kudago" | "timepad" | "seed";

type ImportCategory = {
  key: ImportCategoryKey;
  label: string;
  kudagoCategories: string[];
  timepadQuery: string;
};

type ImportInput = {
  categories?: string[];
  city?: string;
  daysAhead?: number;
  forceSeed?: boolean;
  actorUserId?: string | null;
  sourceName?: string;
};

type ImportSummary = {
  ok: boolean;
  job_id: string | null;
  source: "kudago" | "timepad" | "seed" | "mixed";
  imported_count: number;
  seeded_count: number;
  categories: Array<{ key: string; label: string; imported: number; seeded: number }>;
  warnings: string[];
  errors: string[];
};

type ProviderEvent = {
  sourceName: ProviderName;
  sourceEventId: string;
  sourceUrl: string | null;
  sourceType: "external";
  title: string;
  category: string;
  rawCategory: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceText: string | null;
  ticketUrl: string | null;
  descriptionShort: string | null;
  descriptionFull: string | null;
  sourceMeta: Record<string, unknown>;
};

type EventInsertCandidate = Record<string, unknown>;

const TARGET_PER_CATEGORY = 15;
const MAX_FETCH_PER_CATEGORY = 80;
const MAX_PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 6_500;

const KUDAGO_DEFAULT_BASE = "https://kudago.com/public-api/v1.4";
const TIMEPAD_DEFAULT_BASE = "https://api.timepad.ru/v1";

const CATEGORIES: ImportCategory[] = [
  {
    key: "sports",
    label: "sports",
    kudagoCategories: ["sport"],
    timepadQuery: "спорт",
  },
  {
    key: "concerts",
    label: "concerts",
    kudagoCategories: ["concert"],
    timepadQuery: "концерт",
  },
  {
    key: "arts",
    label: "arts",
    kudagoCategories: ["theater", "exhibition", "education", "festival", "lecture", "art", "culture"],
    timepadQuery: "искусство",
  },
  {
    key: "quests",
    label: "quests",
    kudagoCategories: ["quest"],
    timepadQuery: "квест",
  },
  {
    key: "other",
    label: "other",
    kudagoCategories: ["party", "games", "cinema", "photo", "market", "open-air", "business-events"],
    timepadQuery: "встреча",
  },
];

const CITY_ALIASES: Record<string, { slug: string; label: string }> = {
  moscow: { slug: "msk", label: "Moscow" },
  "москва": { slug: "msk", label: "Moscow" },
  msk: { slug: "msk", label: "Moscow" },
  spb: { slug: "spb", label: "Saint Petersburg" },
  piter: { slug: "spb", label: "Saint Petersburg" },
  "санкт-петербург": { slug: "spb", label: "Saint Petersburg" },
  "питер": { slug: "spb", label: "Saint Petersburg" },
  ekb: { slug: "ekb", label: "Ekaterinburg" },
  "екатеринбург": { slug: "ekb", label: "Ekaterinburg" },
  nsk: { slug: "nsk", label: "Novosibirsk" },
  "новосибирск": { slug: "nsk", label: "Novosibirsk" },
  kzn: { slug: "kzn", label: "Kazan" },
  "казань": { slug: "kzn", label: "Kazan" },
  nnv: { slug: "nnv", label: "Nizhny Novgorod" },
  "нижний новгород": { slug: "nnv", label: "Nizhny Novgorod" },
};

const DEFAULT_CITY_POOL = [
  { slug: "msk", label: "Moscow" },
  { slug: "spb", label: "Saint Petersburg" },
  { slug: "kzn", label: "Kazan" },
  { slug: "ekb", label: "Ekaterinburg" },
  { slug: "nsk", label: "Novosibirsk" },
];

const SEED_TITLES: Record<ImportCategoryKey, string[]> = {
  sports: [
    "Night Sports Meetup",
    "City Run + Networking",
    "Streetball Open Court",
    "Volleyball Mix Day",
    "Fitness Outdoor Group",
  ],
  concerts: [
    "Live Band Friday",
    "Indie Night Session",
    "Acoustic Meetup",
    "Open Mic Stage",
    "Electronic Weekend Set",
  ],
  arts: [
    "Modern Art Dialog",
    "Creative Lecture Night",
    "Cinema + Discussion",
    "Illustration Club",
    "Contemporary Culture Meet",
  ],
  quests: [
    "City Quest Challenge",
    "Escape Team Mission",
    "Mystery Walk",
    "Puzzle Group Game",
    "Urban Story Quest",
  ],
  other: [
    "City Meetup Night",
    "Community Networking",
    "Weekend Hangout",
    "Open City Walk",
    "New Connections Session",
  ],
};

function asString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cutText(input: string, max = 260) {
  const text = input.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function parsePrice(text: string): { min: number | null; max: number | null; note: string | null } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { min: null, max: null, note: null };

  const free = /бесплат|free/i.test(clean);
  if (free) return { min: 0, max: 0, note: "Бесплатно" };

  const nums = clean
    .replace(/[,]/g, ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map((x) => Number(x))
    .filter((x) => Number.isFinite(x));

  if (!nums?.length) return { min: null, max: null, note: clean };
  if (nums.length === 1) return { min: nums[0] ?? null, max: nums[0] ?? null, note: clean };

  const sorted = nums.sort((a, b) => a - b);
  return { min: sorted[0] ?? null, max: sorted[sorted.length - 1] ?? null, note: clean };
}

function parseArrayPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
  }

  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  const candidates = [
    obj.results,
    obj.items,
    obj.events,
    obj.values,
    obj.data,
    (obj.response as Record<string, unknown> | undefined)?.results,
    (obj.response as Record<string, unknown> | undefined)?.events,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
    }
  }

  return [];
}

function normalizeCityPool(rawCity?: string) {
  const list: Array<{ slug: string; label: string }> = [];
  const key = asString(rawCity).toLowerCase();
  const matched = key ? CITY_ALIASES[key] : null;

  if (matched) list.push(matched);

  for (const item of DEFAULT_CITY_POOL) {
    if (!list.find((x) => x.slug === item.slug)) list.push(item);
  }

  return list;
}

function pickCategories(raw?: string[]) {
  if (!raw?.length) return CATEGORIES;
  const requested = new Set(raw.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const filtered = CATEGORIES.filter((c) => requested.has(c.key) || requested.has(c.label.toLowerCase()));
  return filtered.length ? filtered : CATEGORIES;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    return { ok: res.ok, status: res.status, json };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: { error: error instanceof Error ? error.message : "network error" },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchKudagoEvents(params: {
  category: ImportCategory;
  citySlug: string;
  cityLabel: string;
  daysAhead: number;
  max: number;
  timeoutMs: number;
}): Promise<{ items: ProviderEvent[]; warnings: string[] }> {
  const env = getServerEnv();
  const base = (env.KUDAGO_BASE_URL || KUDAGO_DEFAULT_BASE).replace(/\/+$/, "");
  const warnings: string[] = [];
  const all: ProviderEvent[] = [];

  const now = new Date();
  const until = new Date(now.getTime() + Math.max(7, params.daysAhead) * 24 * 60 * 60 * 1000);

  const actualSince = Math.floor(now.getTime() / 1000);
  const actualUntil = Math.floor(until.getTime() / 1000);

  for (let page = 1; page <= 3; page += 1) {
    if (all.length >= params.max) break;

    const q = new URLSearchParams();
    q.set("lang", "ru");
    q.set("location", params.citySlug);
    q.set("actual_since", String(actualSince));
    q.set("actual_until", String(actualUntil));
    q.set("categories", params.category.kudagoCategories.join(","));
    q.set("page_size", String(MAX_PAGE_SIZE));
    q.set("page", String(page));
    q.set(
      "fields",
      [
        "id",
        "title",
        "short_title",
        "description",
        "body_text",
        "site_url",
        "dates",
        "place",
        "categories",
        "images",
        "price",
        "is_free",
      ].join(","),
    );

    const url = `${base}/events/?${q.toString()}`;
    const res = await fetchJson(url, { method: "GET" }, params.timeoutMs);

    if (!res.ok) {
      warnings.push(`KudaGo request failed (${params.category.key}/${params.citySlug}/p${page}): ${res.status}`);
      break;
    }

    const rows = parseArrayPayload(res.json);
    if (!rows.length) break;

    for (const row of rows) {
      if (all.length >= params.max) break;

      const idRaw = row.id ?? row.slug;
      const sourceEventId = `${idRaw ?? randomUUID()}`;

      const dates = Array.isArray(row.dates) ? row.dates : [];
      const firstDate = (dates.find((d) => d && typeof d === "object") ?? {}) as Record<string, unknown>;

      const startsAt =
        parseDate(firstDate.start) ||
        parseDate(firstDate.start_date) ||
        parseDate(firstDate.start_time) ||
        new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const endsAt = parseDate(firstDate.end) || parseDate(firstDate.end_date) || null;

      const place = (row.place && typeof row.place === "object" ? row.place : {}) as Record<string, unknown>;

      const image = Array.isArray(row.images)
        ? row.images
            .map((x) => {
              if (typeof x === "string") return x;
              if (x && typeof x === "object") return asString((x as Record<string, unknown>).image);
              return "";
            })
            .find(Boolean)
        : "";

      const title = asString(row.title) || asString(row.short_title) || `${params.category.label} event`;
      const shortDescription = cutText(stripHtml(asString(row.description) || asString(row.short_title) || title), 220);
      const fullDescription = cutText(stripHtml(asString(row.body_text) || asString(row.description) || title), 2400);

      const rawCategory = Array.isArray(row.categories)
        ? row.categories.map((x) => `${x ?? ""}`).filter(Boolean).join(",")
        : params.category.kudagoCategories.join(",");

      const priceInfo = parsePrice(asString(row.price));
      const isFree = row.is_free === true || priceInfo.min === 0;

      all.push({
        sourceName: "kudago",
        sourceEventId,
        sourceUrl: asString(row.site_url) || null,
        sourceType: "external",
        title,
        category: params.category.key,
        rawCategory,
        city: params.cityLabel,
        startsAt,
        endsAt,
        venueName: asString(place.title) || asString(place.name) || null,
        venueAddress: asString(place.address) || null,
        imageUrl: image || null,
        priceMin: isFree ? 0 : priceInfo.min,
        priceMax: isFree ? 0 : priceInfo.max,
        priceText: isFree ? "Бесплатно" : priceInfo.note,
        ticketUrl: asString(row.site_url) || null,
        descriptionShort: shortDescription,
        descriptionFull: fullDescription,
        sourceMeta: {
          provider: "kudago",
          location: params.citySlug,
          page,
        },
      });
    }
  }

  return { items: all.slice(0, params.max), warnings };
}

async function fetchTimepadEvents(params: {
  category: ImportCategory;
  cityLabel: string;
  daysAhead: number;
  max: number;
  timeoutMs: number;
}): Promise<{ items: ProviderEvent[]; warnings: string[] }> {
  const env = getServerEnv();
  const warnings: string[] = [];

  if (isPlaceholderEnvValue(env.TIMEPAD_TOKEN)) {
    warnings.push("Timepad token отсутствует, пропускаем Timepad добор");
    return { items: [], warnings };
  }

  const base = (env.TIMEPAD_BASE_URL || TIMEPAD_DEFAULT_BASE).replace(/\/+$/, "");
  const endpoints = [`${base}/events`, `${base}/events.json`];

  const now = new Date();
  const until = new Date(now.getTime() + Math.max(7, params.daysAhead) * 24 * 60 * 60 * 1000);

  const items: ProviderEvent[] = [];

  for (const endpoint of endpoints) {
    if (items.length >= params.max) break;

    const q = new URLSearchParams();
    q.set("limit", "100");
    q.set("skip", "0");
    q.set("sort", "+starts_at");
    q.set("starts_at_min", now.toISOString());
    q.set("starts_at_max", until.toISOString());
    q.set("q", params.category.timepadQuery);
    q.set("city", params.cityLabel);

    const res = await fetchJson(
      `${endpoint}?${q.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.TIMEPAD_TOKEN}`,
          Accept: "application/json",
        },
      },
      params.timeoutMs,
    );

    if (!res.ok) {
      warnings.push(`Timepad request failed (${params.category.key}/${params.cityLabel}): ${res.status}`);
      continue;
    }

    const rows = parseArrayPayload(res.json);
    if (!rows.length) continue;

    for (const row of rows) {
      if (items.length >= params.max) break;

      const sourceEventId = `${row.id ?? row.slug ?? randomUUID()}`;
      const startsAt = parseDate(row.starts_at) || parseDate(row.start_at) || parseDate(row.datetime);
      if (!startsAt) continue;

      const endsAt = parseDate(row.ends_at) || parseDate(row.end_at) || null;

      const location =
        row.location && typeof row.location === "object"
          ? (row.location as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const organization =
        row.organization && typeof row.organization === "object"
          ? (row.organization as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const imageUrl =
        asString((row.poster_image as Record<string, unknown> | undefined)?.default_url) ||
        asString((row.logo_image as Record<string, unknown> | undefined)?.default_url) ||
        asString(row.image) ||
        null;

      const title = asString(row.name) || asString(row.title) || `${params.category.label} event`;
      const shortDescription = cutText(stripHtml(asString(row.description_short) || asString(row.description) || title), 220);
      const fullDescription = cutText(stripHtml(asString(row.description) || asString(row.annotation) || title), 2400);

      const priceMin = asNumber(row.min_price);
      const priceMax = asNumber(row.max_price);
      const priceText =
        asString(row.price) ||
        (priceMin != null
          ? priceMax != null && priceMax > priceMin
            ? `${priceMin}-${priceMax} ₽`
            : `${priceMin} ₽`
          : null);

      items.push({
        sourceName: "timepad",
        sourceEventId,
        sourceUrl: asString(row.url) || asString(row.registration_data && (row.registration_data as Record<string, unknown>).url) || null,
        sourceType: "external",
        title,
        category: params.category.key,
        rawCategory: asString(row.category) || params.category.timepadQuery,
        city: asString(location.city) || params.cityLabel,
        startsAt,
        endsAt,
        venueName: asString(location.title) || asString(organization.name) || null,
        venueAddress: asString(location.address) || null,
        imageUrl,
        priceMin,
        priceMax,
        priceText,
        ticketUrl: asString(row.url) || null,
        descriptionShort: shortDescription,
        descriptionFull: fullDescription,
        sourceMeta: {
          provider: "timepad",
        },
      });
    }
  }

  return { items: items.slice(0, params.max), warnings };
}

function makeSeedEvent(category: ImportCategory, city: string, index: number): ProviderEvent {
  const titleSet = SEED_TITLES[category.key];
  const title = `${titleSet[index % titleSet.length]} · #${index + 1}`;
  const startsAt = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000 + (index % 4) * 3600 * 1000).toISOString();
  const paid = index % 3 !== 0;
  const price = paid ? 700 + (index % 6) * 250 : 0;

  return {
    sourceName: "seed",
    sourceEventId: `seed-${category.key}-${index + 1}`,
    sourceUrl: null,
    sourceType: "external",
    title,
    category: category.key,
    rawCategory: category.key,
    city,
    startsAt,
    endsAt: null,
    venueName: `${city} spot #${index + 1}`,
    venueAddress: `${city}, Test street ${10 + index}`,
    imageUrl: `https://placehold.co/1280x720/0E2530/E7F6FF?text=${encodeURIComponent(title)}`,
    priceMin: price,
    priceMax: price,
    priceText: paid ? `${price} ₽` : "Бесплатно",
    ticketUrl: null,
    descriptionShort: "Seed fallback событие для стабильного наполнения вкладок.",
    descriptionFull: "Событие создано fallback-скриптом. Используется как страховка, если внешние источники временно недоступны.",
    sourceMeta: {
      provider: "seed",
      generated_at: new Date().toISOString(),
      category: category.key,
    },
  };
}

function dedupeEvents(rows: ProviderEvent[]) {
  const map = new Map<string, ProviderEvent>();
  for (const row of rows) {
    const key = `${row.sourceName}:${row.sourceEventId}`;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function providerSummary(rows: ProviderEvent[]) {
  let fromKudago = 0;
  let fromTimepad = 0;
  let fromSeed = 0;

  for (const row of rows) {
    if (row.sourceName === "kudago") fromKudago += 1;
    else if (row.sourceName === "timepad") fromTimepad += 1;
    else fromSeed += 1;
  }

  return { fromKudago, fromTimepad, fromSeed };
}

function mapToEventInsert(row: ProviderEvent, jobId: string | null): EventInsertCandidate {
  const startsAt = row.startsAt;
  const endsAt = row.endsAt;

  return {
    source_name: row.sourceName,
    source_event_id: row.sourceEventId,
    external_event_id: row.sourceEventId,
    source_url: row.sourceUrl,
    external_url: row.sourceUrl,
    source_type: row.sourceType,
    source_kind: row.sourceType,
    title: row.title,
    category: row.category,
    raw_category: row.rawCategory,
    city: row.city,
    starts_at: startsAt,
    ends_at: endsAt,
    event_date: startsAt,
    venue_name: row.venueName,
    venue_address: row.venueAddress,
    location: row.venueName || row.venueAddress || row.city,
    image_url: row.imageUrl,
    cover_url: row.imageUrl,
    price_min: row.priceMin,
    price_max: row.priceMax,
    price_text: row.priceText,
    price_note: row.priceText,
    price: row.priceMin ?? 0,
    is_paid: (row.priceMin ?? 0) > 0,
    ticket_url: row.ticketUrl,
    external_source: row.sourceName,
    description_short: row.descriptionShort,
    description_full: row.descriptionFull,
    short_description: row.descriptionShort,
    full_description: row.descriptionFull,
    description: row.descriptionShort,
    source_meta: row.sourceMeta,
    import_job_id: jobId,
    status: "published",
    moderation_status: "approved",
    is_demo: row.sourceName === "seed",
    demo_group: row.sourceName === "seed" ? "seed" : null,
    updated_at: new Date().toISOString(),
  };
}

async function createJob(
  table: "event_import_jobs" | "import_jobs" | null,
  cols: Set<string>,
  input: {
    actorUserId?: string | null;
    sourceName: string;
    categories: string[];
    city: string;
    stats?: Record<string, unknown>;
  },
): Promise<string | null> {
  if (!table || !cols.size) return null;

  const now = new Date().toISOString();
  const id = randomUUID();

  const payloadBase: Record<string, unknown> = {
    id,
    source_name: input.sourceName,
    status: "running",
    started_at: now,
    created_by: input.actorUserId ?? null,
    created_at: now,
    updated_at: now,
    city: input.city,
    requested_categories: input.categories,
    stats_json: input.stats ?? {},
    meta: input.stats ?? {},
  };

  const payload = pickExistingColumns(payloadBase, cols);
  const res = await supabaseAdmin.from(table).insert(payload).select("id").maybeSingle();
  if (res.error) return null;
  return String(res.data?.id ?? id);
}

async function updateJob(
  table: "event_import_jobs" | "import_jobs" | null,
  cols: Set<string>,
  jobId: string | null,
  patch: Record<string, unknown>,
) {
  if (!table || !jobId || !cols.size) return;

  const payload = pickExistingColumns(
    {
      ...patch,
      updated_at: new Date().toISOString(),
    },
    cols,
  );

  if (!Object.keys(payload).length) return;
  await supabaseAdmin.from(table).update(payload).eq("id", jobId);
}

async function replaceEvents(
  rows: EventInsertCandidate[],
  categories: ImportCategory[],
  eventCols: Set<string>,
) {
  if (!rows.length) return;

  const categoryKeys = categories.map((c) => c.key);

  if (eventCols.has("category") && (eventCols.has("source_type") || eventCols.has("source_kind"))) {
    let cleanup = supabaseAdmin.from("events").delete().in("category", categoryKeys);

    if (eventCols.has("source_type")) cleanup = cleanup.eq("source_type", "external");
    else cleanup = cleanup.eq("source_kind", "external");

    if (eventCols.has("source_name")) cleanup = cleanup.in("source_name", ["kudago", "timepad", "seed"]);

    const res = await cleanup;
    if (res.error) throw new Error(res.error.message);
  }

  const prepared = rows.map((row) => pickExistingColumns(row, eventCols));
  const chunks: Array<Record<string, unknown>[]> = [];

  for (let i = 0; i < prepared.length; i += 250) {
    chunks.push(prepared.slice(i, i + 250));
  }

  for (const chunk of chunks) {
    let result;
    if (eventCols.has("source_name") && eventCols.has("source_event_id")) {
      result = await supabaseAdmin.from("events").upsert(chunk, { onConflict: "source_name,source_event_id" });
    } else if (eventCols.has("source_name") && eventCols.has("external_event_id")) {
      result = await supabaseAdmin.from("events").upsert(chunk, { onConflict: "source_name,external_event_id" });
    } else {
      result = await supabaseAdmin.from("events").insert(chunk);
    }

    if (result.error) throw new Error(result.error.message);
  }
}

export async function runEventsImport(input: ImportInput = {}): Promise<ImportSummary> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const env = getServerEnv();
  const categories = pickCategories(input.categories);
  const city = asString(input.city) || "Moscow";
  const forceSeed = Boolean(input.forceSeed);
  const daysAhead = Math.max(7, Math.min(90, Number(input.daysAhead ?? 30)));
  const timeoutMs = Math.max(1000, Math.min(20_000, Number(env.EXTERNAL_IMPORT_TIMEOUT_MS ?? FETCH_TIMEOUT_MS)));

  const schema = await getSchemaSnapshot(["events", "event_import_jobs", "import_jobs"]);
  const eventCols = asSet(schema, "events");
  const eventImportJobCols = asSet(schema, "event_import_jobs");
  const legacyImportJobCols = asSet(schema, "import_jobs");

  const jobTable: "event_import_jobs" | "import_jobs" | null = eventImportJobCols.size
    ? "event_import_jobs"
    : legacyImportJobCols.size
      ? "import_jobs"
      : null;
  const jobCols = jobTable === "event_import_jobs" ? eventImportJobCols : legacyImportJobCols;

  if (!eventCols.size) {
    return {
      ok: false,
      job_id: null,
      source: "seed",
      imported_count: 0,
      seeded_count: 0,
      categories: categories.map((c) => ({ key: c.key, label: c.label, imported: 0, seeded: TARGET_PER_CATEGORY })),
      warnings,
      errors: ["events table missing"],
    };
  }

  const jobId = await createJob(jobTable, jobCols, {
    actorUserId: input.actorUserId,
    sourceName: asString(input.sourceName) || "kudago_timepad",
    categories: categories.map((c) => c.key),
    city,
    stats: {
      requested_days: daysAhead,
      force_seed: forceSeed,
      app_env: env.APP_ENV,
    },
  });

  const finalRows: ProviderEvent[] = [];
  const categorySummary: Array<{ key: string; label: string; imported: number; seeded: number }> = [];

  for (const category of categories) {
    const cityPool = normalizeCityPool(city);
    const categoryImported: ProviderEvent[] = [];

    if (!forceSeed) {
      const dayWindows = Array.from(new Set([Math.min(daysAhead, 30), 60, 90].filter((x) => x > 0)));

      for (const windowDays of dayWindows) {
        for (const cityInfo of cityPool) {
          if (categoryImported.length >= MAX_FETCH_PER_CATEGORY) break;

          const k = await fetchKudagoEvents({
            category,
            citySlug: cityInfo.slug,
            cityLabel: cityInfo.label,
            daysAhead: windowDays,
            max: MAX_FETCH_PER_CATEGORY - categoryImported.length,
            timeoutMs,
          });

          if (k.warnings.length) warnings.push(...k.warnings);
          categoryImported.push(...k.items);

          if (categoryImported.length >= TARGET_PER_CATEGORY) break;
        }

        if (categoryImported.length >= TARGET_PER_CATEGORY) break;
      }

      const dedupAfterKudago = dedupeEvents(categoryImported);

      if (dedupAfterKudago.length < TARGET_PER_CATEGORY) {
        const remaining = TARGET_PER_CATEGORY - dedupAfterKudago.length;

        for (const cityInfo of cityPool) {
          const t = await fetchTimepadEvents({
            category,
            cityLabel: cityInfo.label,
            daysAhead: 90,
            max: Math.max(remaining, 12),
            timeoutMs,
          });

          if (t.warnings.length) warnings.push(...t.warnings);
          dedupAfterKudago.push(...t.items);

          if (dedupAfterKudago.length >= TARGET_PER_CATEGORY) break;
        }
      }

      categoryImported.splice(0, categoryImported.length, ...dedupeEvents(dedupAfterKudago));
    }

    const importedRows = categoryImported.slice(0, TARGET_PER_CATEGORY);
    const missing = Math.max(0, TARGET_PER_CATEGORY - importedRows.length);
    const seeds = Array.from({ length: missing }, (_, i) => makeSeedEvent(category, city, i));

    finalRows.push(...importedRows, ...seeds);
    categorySummary.push({
      key: category.key,
      label: category.label,
      imported: importedRows.length,
      seeded: seeds.length,
    });
  }

  const mappedRows = finalRows.map((row) => mapToEventInsert(row, jobId));

  try {
    await replaceEvents(mappedRows, categories, eventCols);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to write imported events";
    errors.push(message);

    await updateJob(jobTable, jobCols, jobId, {
      status: "error",
      finished_at: new Date().toISOString(),
      imported_count: finalRows.filter((x) => x.sourceName !== "seed").length,
      seeded_count: finalRows.filter((x) => x.sourceName === "seed").length,
      error_text: errors.join(" | "),
      errors,
      stats_json: {
        categories: categorySummary,
        warnings,
      },
      meta: {
        categories: categorySummary,
        warnings,
      },
    });

    return {
      ok: false,
      job_id: jobId,
      source: "seed",
      imported_count: finalRows.filter((x) => x.sourceName !== "seed").length,
      seeded_count: finalRows.filter((x) => x.sourceName === "seed").length,
      categories: categorySummary,
      warnings,
      errors,
    };
  }

  const provider = providerSummary(finalRows);
  const importedCount = provider.fromKudago + provider.fromTimepad;
  const seededCount = provider.fromSeed;

  const source: ImportSummary["source"] =
    importedCount > 0 && seededCount > 0
      ? "mixed"
      : provider.fromKudago > 0 && provider.fromTimepad === 0
        ? "kudago"
        : provider.fromTimepad > 0 && provider.fromKudago === 0
          ? "timepad"
          : importedCount > 0
            ? "mixed"
            : "seed";

  await updateJob(jobTable, jobCols, jobId, {
    status: "ok",
    finished_at: new Date().toISOString(),
    imported_count: importedCount,
    seeded_count: seededCount,
    error_text: errors.join(" | "),
    errors,
    stats_json: {
      categories: categorySummary,
      providers: provider,
      warnings,
    },
    meta: {
      categories: categorySummary,
      providers: provider,
      warnings,
    },
  });

  return {
    ok: true,
    job_id: jobId,
    source,
    imported_count: importedCount,
    seeded_count: seededCount,
    categories: categorySummary,
    warnings,
    errors,
  };
}
