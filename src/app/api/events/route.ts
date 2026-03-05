import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { normalizeEventRow, type EventProjection } from "@/server/events";
import { busyResponse, checkRateLimit, clientKeyFromRequest, withConcurrencyLimit } from "@/server/runtime-guard";

type EventMemberRow = {
  event_id: string;
  user_id: string;
  users: { id: string; name: string; avatar_url: string | null } | Array<{ id: string; name: string; avatar_url: string | null }> | null;
};

type CompanionRow = { event_id: string; user_id: string; status?: string | null };

const querySchema = z.object({
  feed: z.enum(["all", "external", "community"]).default("all"),
  tab: z.enum(["all", "popular", "concerts", "sport", "quests", "community"]).default("all"),
  search: z.string().trim().max(120).default(""),
  city: z.string().trim().max(80).default(""),
  category: z.string().trim().max(80).default(""),
  limit: z.coerce.number().int().min(1).max(120).default(15),
});

const TAB_CATEGORY_MAP: Record<string, string[]> = {
  popular: [],
  concerts: ["concert", "концерт", "music", "музыка"],
  sport: ["sport", "sports", "спорт", "match", "футбол", "баскетбол"],
  quests: ["quest", "quests", "квест", "escape", "эскейп"],
  all: [],
  community: [],
};

const EVENTS_CACHE_TTL_MS = 8_000;
const EVENTS_CACHE_STALE_MS = 60_000;

type EventsPayload = {
  items: Array<{
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
    is_today: boolean;
    participants: Array<{ id: string; name: string; avatar_url: string | null }>;
    going_count: number;
    companion_count: number;
    joined: boolean;
    looking_company: boolean;
  }>;
  meta: {
    feed: "all" | "external" | "community";
    tab: "all" | "popular" | "concerts" | "sport" | "quests" | "community";
    total: number;
    category: string;
    has_companion: boolean;
    cache?: { mode: "hot" | "stale"; cached_at: string };
  };
};

type CacheEntry = { payload: EventsPayload; cachedAt: number; expiresAt: number };
const eventsCache = new Map<string, CacheEntry>();

function cacheKey(input: { feed: string; tab: string; search: string; city: string; category: string; limit: number; userId: string | null }) {
  return `${input.feed}:${input.tab}:${input.search.toLowerCase()}:${input.city.toLowerCase()}:${input.category.toLowerCase()}:${input.limit}:${input.userId || "anon"}`;
}

function matchesCategoryByTab(category: string, tab: string) {
  const rules = TAB_CATEGORY_MAP[tab] ?? [];
  if (!rules.length) return true;
  const c = category.toLowerCase();
  return rules.some((x) => c.includes(x));
}

function matchesExplicitCategory(category: string, explicit: string) {
  if (!explicit) return true;
  const c = category.toLowerCase();
  const e = explicit.toLowerCase();
  return c.includes(e) || e.includes(c);
}

export async function GET(req: Request) {
  const userId = getCurrentUserId();
  const { searchParams } = new URL(req.url);

  const parsed = querySchema.safeParse({
    feed: searchParams.get("feed") ?? "all",
    tab: searchParams.get("tab") ?? "all",
    search: searchParams.get("search") ?? "",
    city: searchParams.get("city") ?? "",
    category: searchParams.get("category") ?? "",
    limit: searchParams.get("limit") ?? 15,
  });

  const filters = parsed.success
    ? parsed.data
    : { feed: "all" as const, tab: "all" as const, search: "", city: "", category: "", limit: 15 };

  const key = cacheKey({ ...filters, userId });
  const now = Date.now();
  const cached = eventsCache.get(key);

  const rate = checkRateLimit(`events:${clientKeyFromRequest(req)}`, 50, 10_000);
  if (!rate.ok) {
    if (cached && now - cached.cachedAt <= EVENTS_CACHE_STALE_MS) {
      return ok({
        ...cached.payload,
        meta: {
          ...cached.payload.meta,
          cache: { mode: "stale", cached_at: new Date(cached.cachedAt).toISOString() },
        },
      });
    }

    return fail("Слишком много запросов к событиям. Повтори через пару секунд.", 429, {
      code: "RATE_LIMIT",
      endpoint: "/api/events",
      hint: `Повтори через ${rate.retryAfterSec} сек`,
    });
  }

  if (cached && cached.expiresAt > now) {
    return ok({
      ...cached.payload,
      meta: {
        ...cached.payload.meta,
        cache: { mode: "hot", cached_at: new Date(cached.cachedAt).toISOString() },
      },
    });
  }

  try {
    const payload = await withConcurrencyLimit("events:list", 5, async () => {
      const schema = await getSchemaSnapshot(["events", "event_members", "event_companion_requests"]);
      const eventsCols = asSet(schema, "events");
      const hasCompanionTable = (schema["event_companion_requests"] ?? []).length > 0;

      const selectCols = [
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
        "city",
        "location",
        "venue_name",
        "venue_address",
        "category",
        "source_kind",
        "source_type",
        "external_source",
        "external_url",
        "source_url",
        "organizer_telegram",
        "social_mode",
        "participant_limit",
        "looking_for_count",
        "submission_id",
        "status",
        "moderation_status",
        "source_meta",
        "is_paid",
      ].filter((c) => eventsCols.has(c));

      let q = supabaseAdmin.from("events").select(selectCols.join(",")).limit(filters.limit);

      if (eventsCols.has("status")) q = q.eq("status", "published");
      else if (eventsCols.has("moderation_status")) q = q.eq("moderation_status", "published");

      if (filters.feed !== "all") {
        if (eventsCols.has("source_type")) q = q.eq("source_type", filters.feed);
        else if (eventsCols.has("source_kind")) q = q.eq("source_kind", filters.feed);
      }

      if (filters.city && eventsCols.has("city")) {
        q = q.ilike("city", `%${filters.city}%`);
      }

      if (filters.category && eventsCols.has("category")) {
        q = q.ilike("category", `%${filters.category}%`);
      }

      if (eventsCols.has("starts_at")) q = q.order("starts_at", { ascending: true });
      else if (eventsCols.has("event_date")) q = q.order("event_date", { ascending: true });

      const eventsRes = await q;
      if (eventsRes.error) throw new Error(eventsRes.error.message);

      const baseEvents: EventProjection[] = ((eventsRes.data ?? []) as unknown[]).map((row) => normalizeEventRow(row));

      const events = baseEvents.filter((item: EventProjection) => {
        if (filters.feed === "community" || filters.tab === "community") {
          if (item.source_kind !== "community") return false;
        }

        if (filters.search) {
          const text = `${item.title} ${item.short_description} ${item.full_description} ${item.city}`.toLowerCase();
          if (!text.includes(filters.search.toLowerCase())) return false;
        }

        if (!matchesExplicitCategory(item.category, filters.category)) return false;
        if (!matchesCategoryByTab(item.category, filters.tab)) return false;
        return true;
      });

      const eventIds = events.map((x) => x.id);

      const [membersRes, myMembershipsRes, companionsRes] = await Promise.all([
        eventIds.length
          ? supabaseAdmin
              .from("event_members")
              .select("event_id,user_id,users(id,name,avatar_url)")
              .in("event_id", eventIds)
              .limit(6000)
          : Promise.resolve({ data: [] as EventMemberRow[] }),
        userId && eventIds.length
          ? supabaseAdmin.from("event_members").select("event_id").in("event_id", eventIds).eq("user_id", userId)
          : Promise.resolve({ data: [] as Array<{ event_id: string }> }),
        hasCompanionTable && eventIds.length
          ? supabaseAdmin
              .from("event_companion_requests")
              .select("event_id,user_id,status")
              .in("event_id", eventIds)
              .eq("status", "active")
          : Promise.resolve({ data: [] as CompanionRow[] }),
      ]);

      const members = (membersRes.data ?? []) as EventMemberRow[];
      const myMemberships = new Set(((myMembershipsRes.data ?? []) as Array<{ event_id: string }>).map((x) => x.event_id));
      const companions = (companionsRes.data ?? []) as CompanionRow[];

      const participantsByEvent = new Map<string, Array<{ id: string; name: string; avatar_url: string | null }>>();
      const goingCountByEvent = new Map<string, number>();
      const companionCountByEvent = new Map<string, number>();
      const myCompanionByEvent = new Set<string>();

      for (const row of members) {
        const user = Array.isArray(row.users) ? row.users[0] : row.users;
        if (!user) continue;

        const list = participantsByEvent.get(row.event_id) ?? [];
        if (!list.find((x) => x.id === user.id)) list.push(user);
        participantsByEvent.set(row.event_id, list);
        goingCountByEvent.set(row.event_id, (goingCountByEvent.get(row.event_id) ?? 0) + 1);
      }

      for (const row of companions) {
        companionCountByEvent.set(row.event_id, (companionCountByEvent.get(row.event_id) ?? 0) + 1);
        if (userId && row.user_id === userId) myCompanionByEvent.add(row.event_id);
      }

      const nowTs = Date.now();
      const items = events.map((event) => {
        const startsTs = new Date(event.starts_at).getTime();
        return {
          ...event,
          is_today: Number.isFinite(startsTs)
            ? new Date(startsTs).toDateString() === new Date(nowTs).toDateString()
            : false,
          participants: (participantsByEvent.get(event.id) ?? []).slice(0, 8),
          going_count: goingCountByEvent.get(event.id) ?? 0,
          companion_count: companionCountByEvent.get(event.id) ?? 0,
          joined: myMemberships.has(event.id),
          looking_company: myCompanionByEvent.has(event.id),
        };
      });

      const popularSorted = [...items].sort((a, b) => b.going_count + b.companion_count - (a.going_count + a.companion_count));

      return {
        items: filters.tab === "popular" ? popularSorted : items,
        meta: {
          feed: filters.feed,
          tab: filters.tab,
          total: items.length,
          category: filters.category,
          has_companion: hasCompanionTable,
        },
      } as EventsPayload;
    });

    eventsCache.set(key, {
      payload,
      cachedAt: now,
      expiresAt: now + EVENTS_CACHE_TTL_MS,
    });

    return ok(payload);
  } catch (error) {
    if (cached && now - cached.cachedAt <= EVENTS_CACHE_STALE_MS) {
      return ok({
        ...cached.payload,
        meta: {
          ...cached.payload.meta,
          cache: { mode: "stale", cached_at: new Date(cached.cachedAt).toISOString() },
        },
      });
    }

    if (error instanceof Error && error.message.startsWith("BUSY:")) {
      return busyResponse("/api/events");
    }

    return fail(error instanceof Error ? error.message : "Failed to load events", 500, {
      code: "DB",
      endpoint: "/api/events",
      hint: "Проверь БД и попробуй повторить запрос",
    });
  }
}
