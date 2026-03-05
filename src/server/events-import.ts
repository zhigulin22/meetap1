import "server-only";

import { randomUUID } from "crypto";
import { getServerEnv, isPlaceholderEnvValue } from "@/lib/env";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

type ImportCategoryKey = "sports" | "concerts" | "arts" | "quests" | "standup" | "exhibitions";

type ImportCategory = {
  key: ImportCategoryKey;
  label: string;
  yandexHint: string;
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
  source: "yandex_tickets" | "seed" | "mixed";
  imported_count: number;
  seeded_count: number;
  categories: Array<{ key: string; label: string; imported: number; seeded: number }>;
  warnings: string[];
  errors: string[];
};

type YandexListItem = Record<string, unknown>;
type EventInsertCandidate = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://api.tickets.yandex.net";
const TARGET_PER_CATEGORY = 15;
const MAX_PER_CATEGORY_FETCH = 36;
const DETAIL_CONCURRENCY = 4;
const HTTP_TIMEOUT_MS = 5_500;

const CATEGORIES: ImportCategory[] = [
  { key: "sports", label: "Спорт", yandexHint: "sports" },
  { key: "concerts", label: "Концерты", yandexHint: "concerts" },
  { key: "arts", label: "Искусство", yandexHint: "arts" },
  { key: "quests", label: "Квесты", yandexHint: "quests" },
  { key: "standup", label: "Стендап", yandexHint: "standup" },
  { key: "exhibitions", label: "Выставки", yandexHint: "exhibitions" },
];

const SEED_TITLES: Record<ImportCategoryKey, string[]> = {
  sports: [
    "Ночной футбольный квиз-матч",
    "Street Workout Session",
    "Смешанный волейбольный микс",
    "Пробежка + нетворкинг",
    "Баскет х 3x3",
  ],
  concerts: [
    "Live Session: New Wave",
    "Электро-джем в клубе",
    "Камерный вечер инди",
    "Acoustic Friday",
    "Открытый микрофон + live band",
  ],
  arts: [
    "Ночная галерея молодого искусства",
    "Лекторий по визуальной культуре",
    "Арт-брейншторм с кураторами",
    "Кино-обсуждение авторского фильма",
    "Иллюстрация и комьюнити",
  ],
  quests: [
    "Квест по городу: исторический маршрут",
    "Escape Room: Black Box",
    "Дворовый урбан-квест",
    "Квест-охота за артефактами",
    "Командный mystery-квест",
  ],
  standup: [
    "Открытый стендап вечер",
    "Stand-up battle: new faces",
    "Комедийный open mic",
    "Late Night Standup",
    "Импров и шутки про дейтинг",
  ],
  exhibitions: [
    "Интерактивная медиа-выставка",
    "Фото-проект молодых авторов",
    "Иммерсивная выставка звука",
    "Современный дизайн и люди",
    "Тематическая pop-up экспозиция",
  ],
};

function pickCategoryList(raw?: string[]) {
  if (!raw?.length) return CATEGORIES;
  const keys = new Set(raw.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const filtered = CATEGORIES.filter((c) => keys.has(c.key) || keys.has(c.label.toLowerCase()));
  return filtered.length ? filtered : CATEGORIES;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function asString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readPath(obj: Record<string, unknown> | null | undefined, paths: string[]) {
  for (const path of paths) {
    const chunks = path.split(".");
    let cur: unknown = obj;
    let ok = true;
    for (const chunk of chunks) {
      if (!cur || typeof cur !== "object" || !(chunk in (cur as Record<string, unknown>))) {
        ok = false;
        break;
      }
      cur = (cur as Record<string, unknown>)[chunk];
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

function parseEventListPayload(payload: unknown): YandexListItem[] {
  if (Array.isArray(payload)) return payload.filter((x): x is YandexListItem => Boolean(x && typeof x === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;

  const candidates = [
    obj.items,
    obj.events,
    obj.data,
    readPath(obj, ["result.items", "result.events", "response.events", "response.items"]),
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter((x): x is YandexListItem => Boolean(x && typeof x === "object"));
    }
  }

  return [];
}

function buildYandexEndpoints(baseUrl: string, method: "event.list" | "event.detail") {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const methodPath = method.replace(".", "/");
  return [
    `${trimmed}/${method}`,
    `${trimmed}/${methodPath}`,
    `${trimmed}/v1/${method}`,
    `${trimmed}/v1/${methodPath}`,
    `${trimmed}/agent/${method}`,
    `${trimmed}/agent/${methodPath}`,
  ];
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
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
    return { ok: false, status: 0, json: { error: error instanceof Error ? error.message : "network error" } };
  } finally {
    clearTimeout(timer);
  }
}

async function yandexMethodCall(
  method: "event.list" | "event.detail",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data: unknown; endpoint?: string; error?: string }> {
  const env = getServerEnv();
  const base = env.YANDEX_TICKETS_BASE_URL || DEFAULT_BASE_URL;
  const endpoints = buildYandexEndpoints(base, method);

  for (const endpoint of endpoints) {
    const postAttempt = await fetchJsonWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      HTTP_TIMEOUT_MS,
    );

    if (postAttempt.ok) return { ok: true, data: postAttempt.json, endpoint };

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        params.set(k, v.join(","));
      } else {
        params.set(k, String(v));
      }
    }

    const getAttempt = await fetchJsonWithTimeout(
      `${endpoint}?${params.toString()}`,
      { method: "GET" },
      HTTP_TIMEOUT_MS,
    );

    if (getAttempt.ok) return { ok: true, data: getAttempt.json, endpoint };
  }

  return { ok: false, data: null, error: `Yandex ${method} request failed` };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>) {
  const out = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx] as T, idx);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return out;
}

function yandexEnabled(forceSeed: boolean) {
  if (forceSeed) return false;
  const env = getServerEnv();
  return !isPlaceholderEnvValue(env.YANDEX_TICKETS_AUTH);
}

async function fetchYandexCategory(category: ImportCategory, city: string, daysAhead: number, forceSeed: boolean) {
  if (!yandexEnabled(forceSeed)) {
    return { items: [] as EventInsertCandidate[], warnings: ["Yandex auth не настроен, используем seed"] };
  }

  const env = getServerEnv();
  const from = new Date();
  const to = new Date(Date.now() + Math.max(7, daysAhead) * 24 * 60 * 60 * 1000);

  const listPayload = {
    auth: env.YANDEX_TICKETS_AUTH,
    category: category.yandexHint,
    city,
    limit: MAX_PER_CATEGORY_FETCH,
    from: from.toISOString(),
    to: to.toISOString(),
    locale: "ru_RU",
  };

  const listRes = await yandexMethodCall("event.list", listPayload);
  if (!listRes.ok) {
    return {
      items: [] as EventInsertCandidate[],
      warnings: [`Yandex list failed for ${category.key}`],
      errors: [listRes.error ?? "event.list failed"],
    };
  }

  const listItems = parseEventListPayload(listRes.data).slice(0, MAX_PER_CATEGORY_FETCH);
  if (!listItems.length) {
    return { items: [], warnings: [`Yandex returned no events for ${category.key}`] };
  }

  const details = await mapWithConcurrency(listItems, DETAIL_CONCURRENCY, async (item, index) => {
    const externalId = asString(readPath(item, ["id", "event_id", "eventId", "uuid", "slug"])) || randomUUID();
    const detailPayload = {
      auth: env.YANDEX_TICKETS_AUTH,
      event_id: externalId,
      id: externalId,
      city,
      locale: "ru_RU",
    };

    const detailRes = await yandexMethodCall("event.detail", detailPayload);
    const detailObj = detailRes.ok && detailRes.data && typeof detailRes.data === "object"
      ? (readPath(detailRes.data as Record<string, unknown>, ["result", "event", "data", "response"]) as Record<string, unknown> | null) ??
        (detailRes.data as Record<string, unknown>)
      : null;

    const source = detailObj && Object.keys(detailObj).length ? detailObj : item;

    const startsAt =
      parseDate(readPath(source, ["starts_at", "start_at", "startDate", "datetime", "date"])) ||
      new Date(Date.now() + (index + 1) * 6 * 60 * 60 * 1000).toISOString();

    const endsAt = parseDate(readPath(source, ["ends_at", "end_at", "endDate"]));

    const title =
      asString(readPath(source, ["title", "name", "event_name"])) ||
      `${category.label}: событие ${index + 1}`;

    const shortDescription =
      asString(readPath(source, ["short_description", "summary", "subtitle", "description_short"])) ||
      `Подборка ${category.label.toLowerCase()} в ${city}.`;

    const fullDescription =
      asString(readPath(source, ["full_description", "description", "body", "text"])) || shortDescription;

    const venueName = asString(readPath(source, ["venue.name", "venue_title", "place.name", "location", "hall.name"]));
    const venueAddress = asString(readPath(source, ["venue.address", "place.address", "address"]));
    const eventCity = asString(readPath(source, ["city", "venue.city", "location_city"])) || city;

    const cover =
      asString(readPath(source, ["cover_url", "image", "poster", "images.0.url", "media.0.url"])) ||
      `https://placehold.co/1280x720/f1f5ff/6574b8?text=${encodeURIComponent(title)}`;

    const externalUrl = asString(readPath(source, ["url", "event_url", "source_url", "tickets_url"]));

    const priceMin = asNumber(readPath(source, ["price_min", "price.min", "prices.min", "price"]));
    const priceMax = asNumber(readPath(source, ["price_max", "price.max", "prices.max"]));

    const price = priceMin ?? 0;
    const isPaid = price > 0;
    const priceNote = isPaid
      ? priceMax && priceMax > price
        ? `${price}–${priceMax} ₽`
        : `${price} ₽`
      : "Бесплатно";

    return {
      source_kind: "external",
      source_name: "yandex_tickets",
      external_event_id: externalId,
      category: category.label,
      title,
      short_description: shortDescription,
      full_description: fullDescription,
      description: shortDescription,
      city: eventCity,
      location: venueName || venueAddress || eventCity,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      starts_at: startsAt,
      ends_at: endsAt,
      event_date: startsAt,
      cover_url: cover,
      external_url: externalUrl || null,
      external_source: "Yandex Tickets",
      price,
      is_paid: isPaid,
      price_note: priceNote,
      status: "published",
      moderation_status: "published",
      source_meta: {
        provider: "yandex_tickets",
        provider_category: category.yandexHint,
        provider_payload_sample: {
          has_detail: Boolean(detailObj),
          endpoint: listRes.endpoint,
        },
      },
      is_demo: false,
      demo_group: null,
      updated_at: new Date().toISOString(),
    } as EventInsertCandidate;
  });

  return { items: details };
}

function seedEventFor(category: ImportCategory, city: string, index: number): EventInsertCandidate {
  const titleSet = SEED_TITLES[category.key];
  const title = `${titleSet[index % titleSet.length]} · #${index + 1}`;
  const startsAt = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000 + (index % 5) * 60 * 60 * 1000).toISOString();
  const isPaid = index % 3 !== 0;
  const price = isPaid ? 500 + (index % 8) * 250 : 0;

  return {
    source_kind: "external",
    source_name: "seed",
    external_event_id: `seed-${category.key}-${index + 1}`,
    category: category.label,
    title,
    short_description: `Тестовое ${category.label.toLowerCase()} событие для проверки карточек и фильтров.`,
    full_description:
      "Seed событие: используется как fallback, когда внешний импорт временно недоступен. Можно безопасно удалять и пересоздавать.",
    description: `Seed event for ${category.key}`,
    city,
    location: `${city}, test location #${index + 1}`,
    venue_name: `Venue #${index + 1}`,
    venue_address: `${city}, улица Тестовая ${10 + index}`,
    starts_at: startsAt,
    ends_at: null,
    event_date: startsAt,
    cover_url: `https://placehold.co/1280x720/f1f5ff/6a73b9?text=${encodeURIComponent(title)}`,
    external_url: null,
    external_source: "seed",
    price,
    is_paid: isPaid,
    price_note: isPaid ? `${price} ₽` : "Бесплатно",
    status: "published",
    moderation_status: "published",
    source_meta: {
      provider: "seed",
      generated_at: new Date().toISOString(),
      category: category.key,
    },
    is_demo: true,
    demo_group: "seed",
    updated_at: new Date().toISOString(),
  };
}

async function createImportJob(
  cols: Set<string>,
  input: {
    actorUserId?: string | null;
    sourceName: string;
    categories: string[];
    city: string;
    meta?: Record<string, unknown>;
  },
) {
  if (!cols.size) return null;

  const row = pickExistingColumns(
    {
      id: randomUUID(),
      source_name: input.sourceName,
      status: "running",
      requested_categories: input.categories,
      city: input.city,
      started_at: new Date().toISOString(),
      created_by: input.actorUserId ?? null,
      meta: input.meta ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    cols,
  );

  const ins = await supabaseAdmin.from("import_jobs").insert(row).select("id").maybeSingle();
  if (ins.error) return null;
  return String(ins.data?.id ?? "");
}

async function updateImportJob(cols: Set<string>, jobId: string | null, patch: Record<string, unknown>) {
  if (!jobId || !cols.size) return;
  const payload = pickExistingColumns({ ...patch, updated_at: new Date().toISOString() }, cols);
  if (!Object.keys(payload).length) return;
  await supabaseAdmin.from("import_jobs").update(payload).eq("id", jobId);
}

async function replaceImportedEvents(
  eventCols: Set<string>,
  rows: EventInsertCandidate[],
  categories: ImportCategory[],
  jobId: string | null,
) {
  if (!rows.length) return;

  const categoryLabels = categories.map((c) => c.label);

  if (eventCols.has("source_kind") && eventCols.has("category") && eventCols.has("source_name")) {
    const cleanup = await supabaseAdmin
      .from("events")
      .delete()
      .eq("source_kind", "external")
      .in("category", categoryLabels)
      .in("source_name", ["yandex_tickets", "seed"]);

    if (cleanup.error && !String(cleanup.error.message).toLowerCase().includes("source_name")) {
      throw new Error(cleanup.error.message);
    }
  }

  const prepared = rows.map((row) => {
    const withJob = { ...row, import_job_id: jobId };
    return pickExistingColumns(withJob, eventCols);
  });

  const chunks: Array<EventInsertCandidate[]> = [];
  for (let i = 0; i < prepared.length; i += 250) chunks.push(prepared.slice(i, i + 250));

  for (const chunk of chunks) {
    let res;
    if (eventCols.has("source_name") && eventCols.has("external_event_id")) {
      res = await supabaseAdmin
        .from("events")
        .upsert(chunk, { onConflict: "source_name,external_event_id" });
    } else {
      res = await supabaseAdmin.from("events").insert(chunk);
    }

    if (res.error) throw new Error(res.error.message);
  }
}

export async function runEventsImport(input: ImportInput = {}): Promise<ImportSummary> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const categories = pickCategoryList(input.categories);
  const city = asString(input.city) || "Moscow";
  const daysAhead = Math.max(7, Math.min(90, Number(input.daysAhead ?? 30)));
  const sourceName = asString(input.sourceName) || "yandex_tickets";

  const schema = await getSchemaSnapshot(["events", "import_jobs"]);
  const eventCols = asSet(schema, "events");
  const importJobCols = asSet(schema, "import_jobs");

  if (!eventCols.size) {
    return {
      ok: false,
      job_id: null,
      source: "seed",
      imported_count: 0,
      seeded_count: 0,
      categories: categories.map((c) => ({ key: c.key, label: c.label, imported: 0, seeded: 0 })),
      warnings,
      errors: ["events table missing"],
    };
  }

  const jobId = await createImportJob(importJobCols, {
    actorUserId: input.actorUserId,
    sourceName,
    categories: categories.map((c) => c.key),
    city,
    meta: { force_seed: Boolean(input.forceSeed), days_ahead: daysAhead, app_env: getServerEnv().APP_ENV },
  });

  const finalRows: EventInsertCandidate[] = [];
  const categorySummary: Array<{ key: string; label: string; imported: number; seeded: number }> = [];
  let importedCount = 0;
  let seededCount = 0;

  for (const category of categories) {
    const imported = await fetchYandexCategory(category, city, daysAhead, Boolean(input.forceSeed));
    if (imported.warnings?.length) warnings.push(...imported.warnings);
    if ((imported as any).errors?.length) errors.push(...((imported as any).errors as string[]));

    const dedupe = new Map<string, EventInsertCandidate>();
    for (const row of imported.items ?? []) {
      const key = `${asString(row.external_event_id) || asString(row.title)}|${asString(row.starts_at)}`;
      if (!dedupe.has(key)) dedupe.set(key, row);
    }

    const importedRows = [...dedupe.values()].slice(0, TARGET_PER_CATEGORY);
    const missing = Math.max(0, TARGET_PER_CATEGORY - importedRows.length);
    const seededRows = Array.from({ length: missing }, (_, idx) => seedEventFor(category, city, idx));

    importedCount += importedRows.length;
    seededCount += seededRows.length;

    finalRows.push(...importedRows, ...seededRows);
    categorySummary.push({
      key: category.key,
      label: category.label,
      imported: importedRows.length,
      seeded: seededRows.length,
    });
  }

  try {
    await replaceImportedEvents(eventCols, finalRows, categories, jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to write events";
    errors.push(message);
    await updateImportJob(importJobCols, jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      imported_count: importedCount,
      seeded_count: seededCount,
      errors: errors,
    });

    return {
      ok: false,
      job_id: jobId,
      source: importedCount > 0 && seededCount > 0 ? "mixed" : importedCount > 0 ? "yandex_tickets" : "seed",
      imported_count: importedCount,
      seeded_count: seededCount,
      categories: categorySummary,
      warnings,
      errors,
    };
  }

  await updateImportJob(importJobCols, jobId, {
    status: "finished",
    finished_at: new Date().toISOString(),
    imported_count: importedCount,
    seeded_count: seededCount,
    errors,
  });

  return {
    ok: true,
    job_id: jobId,
    source: importedCount > 0 && seededCount > 0 ? "mixed" : importedCount > 0 ? "yandex_tickets" : "seed",
    imported_count: importedCount,
    seeded_count: seededCount,
    categories: categorySummary,
    warnings,
    errors,
  };
}
