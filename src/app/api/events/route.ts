import { NextResponse } from "next/server";
import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { normalizeEventRow } from "@/server/events";
import { getPrimaryMediaMap } from "@/server/event-media";

const CACHE_TTL_MS = 60_000;
const MAX_LIMIT = 30;

type CacheEntry = { data: EventsResponse; ts: number };
const cache = new Map<string, CacheEntry>();
const staleCache = new Map<string, CacheEntry>();

const DEFAULT_SEED_CITY = "Москва";
const SEED_CATEGORIES = ["sports", "concerts", "arts", "quests", "other"] as const;

type EventsResponse = {
  meta?: Record<string, unknown>;
  items: EventListItem[];
  next_offset: number | null;
  cache?: { mode: "fresh" | "stale"; at: string };
};

type EventListItem = {
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
  is_paid: boolean;
  price: number;
  price_note: string | null;
  external_source: string | null;
  external_url: string | null;
  organizer_telegram: string | null;
  social_mode: string;
  participant_limit: number | null;
  looking_for_count: number | null;
  status: string;
  is_today: boolean;
  participants: Array<{ id: string; name: string; avatar_url: string | null }>;
  going_count: number;
  companion_count: number;
  joined: boolean;
  looking_company: boolean;
};

function clampLimit(raw: number) {
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.min(raw, MAX_LIMIT);
}

function parseBool(value: string | null) {
  if (!value) return false;
  return value === "true" || value === "1" || value === "yes";
}

function buildKey(params: URLSearchParams) {
  return [
    params.get("limit") ?? "",
    params.get("offset") ?? "",
    params.get("feed") ?? "",
    params.get("category") ?? "",
    params.get("sort") ?? "",
    params.get("city") ?? "",
    params.get("q") ?? "",
    params.get("date") ?? "",
    params.get("from") ?? "",
    params.get("to") ?? "",
    params.get("freeOnly") ?? "",
    params.get("lookingOnly") ?? "",
  ].join("|");
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dateRangeFromPreset(preset: string | null) {
  if (!preset || preset === "all") return null;
  const now = new Date();

  if (preset === "today") {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }

  if (preset === "weekend") {
    const day = now.getDay();
    const nextSaturday = new Date(now);
    const shift = day <= 6 ? (6 - day) % 7 : 0;
    nextSaturday.setDate(now.getDate() + shift);
    const sunday = new Date(nextSaturday);
    sunday.setDate(nextSaturday.getDate() + 1);
    return { from: startOfDay(nextSaturday).toISOString(), to: endOfDay(sunday).toISOString() };
  }

  return null;
}

function seedEventRows(now: Date, category: string, count: number) {
  const base = startOfDay(now);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + i + 1);
    rows.push({
      title: `${category.toUpperCase()} Meetup #${i + 1}`,
      category,
      city: DEFAULT_SEED_CITY,
      short_description: "Живое событие с понятной пользой и новыми контактами.",
      full_description: "Собираемся оффлайн, знакомимся и проводим время с пользой.",
      starts_at: date.toISOString(),
      source_type: "seed",
      source_name: "seed",
      source_event_id: `${category}-${i + 1}`,
      source_kind: "external",
      source_url: null,
      image_url: "https://placehold.co/1200x800/edf2ff/5f6fb7?text=EVENT",
      is_paid: false,
      price_min: 0,
      price_max: 0,
      price_text: "Бесплатно",
      status: "published",
      moderation_status: "approved",
    });
  }
  return rows;
}

async function ensureSeed(eventsCols: Set<string>) {
  const { count } = (await supabaseAdmin.from("events").select("id", { count: "exact", head: true })) as {
    count: number | null;
  };

  if ((count ?? 0) > 0) return;

  const now = new Date();
  const payload: Record<string, unknown>[] = [];
  for (const category of SEED_CATEGORIES) {
    payload.push(...seedEventRows(now, category, 15));
  }

  const insertPayload = payload.map((row) => pickExistingColumns(row, eventsCols));
  if (insertPayload.length) {
    await supabaseAdmin.from("events").insert(insertPayload);
  }
}

export async function GET(req: Request) {
  const userId = getCurrentUserId();
  const url = new URL(req.url);
  const limit = clampLimit(Number(url.searchParams.get("limit")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const feed = (url.searchParams.get("feed") || "all").toLowerCase();
  const category = (url.searchParams.get("category") || "all").toLowerCase();
  const sort = (url.searchParams.get("sort") || "soon").toLowerCase();
  const city = url.searchParams.get("city")?.trim() || null;
  const q = url.searchParams.get("q")?.trim() || null;
  const freeOnly = parseBool(url.searchParams.get("freeOnly"));
  const lookingOnly = parseBool(url.searchParams.get("lookingOnly"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const presetRange = dateRangeFromPreset(url.searchParams.get("date"));

  const key = buildKey(url.searchParams);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return ok({ ...cached.data, cache: { mode: "fresh", at: new Date(cached.ts).toISOString() } });
  }

  try {
    const schema = await getSchemaSnapshot(["events", "event_members", "event_companion_requests"]);
    const eventsCols = asSet(schema, "events");
    await ensureSeed(eventsCols);

    const selectColumns = [
      "id",
      "title",
      "description",
      "short_description",
      "full_description",
      "description_short",
      "description_full",
      "cover_url",
      "image_url",
      "event_date",
      "starts_at",
      "ends_at",
      "price",
      "price_note",
      "price_text",
      "price_min",
      "price_max",
      "city",
      "venue_name",
      "venue_address",
      "location",
      "category",
      "source_kind",
      "source_type",
      "external_source",
      "source_name",
      "external_url",
      "source_url",
      "organizer_telegram",
      "social_mode",
      "participant_limit",
      "looking_for_count",
      "status",
      "moderation_status",
      "source_meta",
      "is_paid",
    ].filter((col) => eventsCols.has(col));

    let query = supabaseAdmin.from("events").select(selectColumns.join(",")).range(offset, offset + limit - 1);

    if (feed === "external") {
      if (eventsCols.has("source_type")) {
        query = query.in("source_type", ["external", "seed"]);
      } else if (eventsCols.has("source_kind")) {
        query = query.eq("source_kind", "external");
      }
    } else if (feed === "community") {
      if (eventsCols.has("source_type")) {
        query = query.eq("source_type", "community");
      } else if (eventsCols.has("source_kind")) {
        query = query.eq("source_kind", "community");
      }
    }

    if (category && category !== "all" && category !== "popular") {
      query = query.eq("category", category);
    }

    if (city) {
      query = query.eq("city", city);
    }

    const range = presetRange ?? (from && to ? { from, to } : null);
    if (range) {
      if (eventsCols.has("starts_at")) {
        query = query.gte("starts_at", range.from).lte("starts_at", range.to);
      } else {
        query = query.gte("event_date", range.from).lte("event_date", range.to);
      }
    }

    if (q) {
      const orParts = [] as string[];
      if (eventsCols.has("title")) orParts.push(`title.ilike.%${q}%`);
      if (eventsCols.has("short_description")) orParts.push(`short_description.ilike.%${q}%`);
      if (eventsCols.has("description_short")) orParts.push(`description_short.ilike.%${q}%`);
      if (eventsCols.has("full_description")) orParts.push(`full_description.ilike.%${q}%`);
      if (eventsCols.has("description_full")) orParts.push(`description_full.ilike.%${q}%`);
      if (eventsCols.has("venue_name")) orParts.push(`venue_name.ilike.%${q}%`);
      if (orParts.length) {
        query = query.or(orParts.join(","));
      }
    }

    if (freeOnly) {
      if (eventsCols.has("is_paid")) {
        query = query.eq("is_paid", false);
      } else if (eventsCols.has("price")) {
        query = query.eq("price", 0);
      }
    }

    if (sort === "popular") {
      if (eventsCols.has("popularity_score")) {
        query = query.order("popularity_score", { ascending: false, nullsFirst: false });
      }
      query = query.order(eventsCols.has("starts_at") ? "starts_at" : "event_date", { ascending: true });
    } else {
      query = query.order(eventsCols.has("starts_at") ? "starts_at" : "event_date", { ascending: true });
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const eventRows = (rows ?? []) as any[];
    const eventIds = eventRows.map((row) => row.id).filter(Boolean);
    const mediaMap = await getPrimaryMediaMap(eventIds);

    const hasMembers = (schema["event_members"] ?? []).length > 0;
    const hasCompanion = (schema["event_companion_requests"] ?? []).length > 0;

    const [membersRes, companionsRes] = await Promise.all([
      hasMembers && eventIds.length
        ? supabaseAdmin
            .from("event_members")
            .select("event_id,user_id,users(id,name,avatar_url)")
            .in("event_id", eventIds)
            .limit(1000)
        : Promise.resolve({ data: [] as Array<{ event_id: string; user_id: string; users: any }> }),
      hasCompanion && eventIds.length
        ? supabaseAdmin
            .from("event_companion_requests")
            .select("event_id,user_id,status")
            .in("event_id", eventIds)
            .eq("status", "active")
        : Promise.resolve({ data: [] as Array<{ event_id: string; user_id: string; status: string }> }),
    ]);

    const members = (membersRes.data ?? []) as Array<{ event_id: string; user_id: string; users: any }>;
    const companions = (companionsRes.data ?? []) as Array<{ event_id: string; user_id: string; status: string }>;

    const participantMap = new Map<string, Array<{ id: string; name: string; avatar_url: string | null }>>();
    const goingCount = new Map<string, number>();
    const joinedSet = new Set<string>();

    for (const row of members) {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!user) continue;
      const list = participantMap.get(row.event_id) ?? [];
      if (list.length < 6) {
        list.push({ id: String(user.id), name: user.name ?? "", avatar_url: user.avatar_url ?? null });
        participantMap.set(row.event_id, list);
      }
      goingCount.set(row.event_id, (goingCount.get(row.event_id) ?? 0) + 1);
      if (userId && row.user_id === userId) {
        joinedSet.add(row.event_id);
      }
    }

    const companionCount = new Map<string, number>();
    const lookingSet = new Set<string>();
    for (const row of companions) {
      companionCount.set(row.event_id, (companionCount.get(row.event_id) ?? 0) + 1);
      if (userId && row.user_id === userId) {
        lookingSet.add(row.event_id);
      }
    }

    const today = startOfDay(new Date()).toISOString().slice(0, 10);

    const items = eventRows
      .map((row) => {
        const base = normalizeEventRow(row);
        const mediaUrl = mediaMap.get(base.id);
        const startDate = base.starts_at.slice(0, 10);
        return {
          ...base,
          cover_url: mediaUrl ?? base.cover_url,
          is_today: startDate === today,
          participants: participantMap.get(base.id) ?? [],
          going_count: goingCount.get(base.id) ?? 0,
          companion_count: companionCount.get(base.id) ?? 0,
          joined: joinedSet.has(base.id),
          looking_company: lookingSet.has(base.id),
        } satisfies EventListItem;
      })
      .filter((item) => {
        if (lookingOnly) return item.companion_count > 0;
        return true;
      });

    const payload: EventsResponse = {
      items,
      next_offset: eventRows.length === limit ? offset + limit : null,
      meta: {
        limit,
        offset,
        feed,
        category,
        city,
        date: url.searchParams.get("date") || "all",
        freeOnly,
        lookingOnly,
      },
    };

    cache.set(key, { data: payload, ts: Date.now() });
    staleCache.set(key, { data: payload, ts: Date.now() });

    return ok({ ...payload, cache: { mode: "fresh", at: new Date().toISOString() } });
  } catch {
    const stale = staleCache.get(key);
    if (stale) {
      return ok({ ...stale.data, cache: { mode: "stale", at: new Date(stale.ts).toISOString() } });
    }
    return NextResponse.json({ error: "Сервис перегружен. Повторите через пару секунд.", code: "SERVER_BUSY" }, { status: 503 });
  }
}
