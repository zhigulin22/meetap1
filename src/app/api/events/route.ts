import { NextResponse } from "next/server";
import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";

type CacheEntry = { data: any; ts: number };
const cache = new Map<string, CacheEntry>();
const staleCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000;

function buildKey(params: URLSearchParams) {
  return [
    params.get("limit") ?? "",
    params.get("offset") ?? "",
    params.get("city") ?? "",
    params.get("from") ?? "",
    params.get("to") ?? "",
  ].join("|");
}

function clampLimit(raw: number) {
  if (Number.isNaN(raw) || raw <= 0) return 20;
  return Math.min(raw, 30);
}

function seedEvents(baseDate: Date, count: number) {
  const items = [] as Array<{
    title: string;
    description: string;
    outcomes: string[];
    cover_url: string;
    event_date: string;
    price: number;
    city: string;
  }>;
  for (let i = 0; i < count; i += 1) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i + 1);
    items.push({
      title: `Городское событие #${i + 1}`,
      description: "Офлайн встреча с обсуждением, живыми людьми и понятной пользой.",
      outcomes: ["нетворкинг", "оффлайн"],
      cover_url: "https://placehold.co/1200x700",
      event_date: date.toISOString(),
      price: 0,
      city: "Москва",
    });
  }
  return items;
}

export async function GET(req: Request) {
  const userId = getCurrentUserId();
  const url = new URL(req.url);
  const limit = clampLimit(Number(url.searchParams.get("limit")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const city = url.searchParams.get("city") || null;
  const from = url.searchParams.get("from") || null;
  const to = url.searchParams.get("to") || null;

  const key = buildKey(url.searchParams);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return ok({ ...cached.data, cache: { mode: "fresh", at: new Date(cached.ts).toISOString() } });
  }

  try {
    let query = supabaseAdmin
      .from("events")
      .select("id,title,description,outcomes,cover_url,event_date,price,city")
      .order("event_date", { ascending: true })
      .range(offset, offset + limit - 1);

    if (city) query = query.eq("city", city);
    if (from) query = query.gte("event_date", from);
    if (to) query = query.lte("event_date", to);

    let { data: events, error } = await query;

    if (error) {
      throw error;
    }

    if ((!events || events.length === 0) && offset === 0) {
      const seedRows = seedEvents(new Date(), 15);
      const seeded = await supabaseAdmin
        .from("events")
        .insert(seedRows)
        .select("id,title,description,outcomes,cover_url,event_date,price,city");
      events = seeded.data ?? [];
    }

    const eventIds = (events ?? []).map((e) => e.id);

    const [{ data: members }, { data: myMemberships }] = await Promise.all([
      eventIds.length
        ? supabaseAdmin
            .from("event_members")
            .select("event_id,users(id,name,avatar_url)")
            .in("event_id", eventIds)
            .limit(200)
        : Promise.resolve({ data: [] }),
      userId && eventIds.length
        ? supabaseAdmin.from("event_members").select("event_id").eq("user_id", userId).in("event_id", eventIds)
        : Promise.resolve({ data: [] as Array<{ event_id: string }> }),
    ]);

    const joinedSet = new Set((myMemberships ?? []).map((x) => x.event_id));
    const grouped = new Map<string, Array<{ id: string; name: string; avatar_url: string | null }>>();

    for (const m of members ?? []) {
      const existing = grouped.get(m.event_id) ?? [];
      const user = Array.isArray(m.users) ? m.users[0] : m.users;
      if (user) {
        existing.push(user as { id: string; name: string; avatar_url: string | null });
        grouped.set(m.event_id, existing.slice(0, 5));
      }
    }

    const payload = {
      items: (events ?? []).map((e) => ({
        ...e,
        participants: (grouped.get(e.id) ?? []).slice(0, 5),
        joined: joinedSet.has(e.id),
      })),
      next_offset: events && events.length === limit ? offset + limit : null,
    };

    cache.set(key, { data: payload, ts: Date.now() });
    staleCache.set(key, { data: payload, ts: Date.now() });

    return ok({ ...payload, cache: { mode: "fresh", at: new Date().toISOString() } });
  } catch {
    const stale = staleCache.get(key);
    if (stale) {
      return ok({ ...stale.data, cache: { mode: "stale", at: new Date(stale.ts).toISOString() } });
    }
    return NextResponse.json({ error: "Сервер занят. Повторите через пару секунд.", code: "SERVER_BUSY" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const city = String(body.city ?? "").trim();
    const telegram = String(body.telegram ?? "").trim();
    const event_date = String(body.event_date ?? "").trim();

    if (!title || !description || !city || !telegram || !event_date) {
      return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
    }

    const price = Number(body.price ?? 0);

    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        title,
        description: `${description}\n\nКонтакт: ${telegram}`,
        outcomes: body.category ? [String(body.category)] : [],
        cover_url: body.cover_url || null,
        event_date,
        price: Number.isFinite(price) ? price : 0,
        city,
      })
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Не удалось сохранить событие" }, { status: 500 });
    }

    return ok({ id: data?.[0]?.id });
  } catch {
    return NextResponse.json({ error: "Не удалось обработать запрос" }, { status: 400 });
  }
}
