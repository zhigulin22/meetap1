import { supabaseAdmin } from "@/supabase/admin";

export type Segment = "all" | "verified" | "new" | "active";

export function parseWindow(from?: string, to?: string, fallbackDays = 30) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - fallbackDays * 24 * 60 * 60 * 1000);

  const safeEnd = Number.isNaN(end.getTime()) ? new Date() : end;
  const safeStartRaw = Number.isNaN(start.getTime())
    ? new Date(safeEnd.getTime() - fallbackDays * 24 * 60 * 60 * 1000)
    : start;

  const safeStart = safeStartRaw.getTime() <= safeEnd.getTime() ? safeStartRaw : safeEnd;
  const safeTo = safeStartRaw.getTime() <= safeEnd.getTime() ? safeEnd : safeStartRaw;

  return {
    from: safeStart,
    to: safeTo,
    fromISO: safeStart.toISOString(),
    toISO: safeTo.toISOString(),
  };
}

export async function getSegmentUserIds(segment: Segment, fromISO: string, toISO: string) {
  if (segment === "all") return null as string[] | null;

  if (segment === "verified") {
    const { data } = await supabaseAdmin.from("users").select("id").eq("telegram_verified", true).limit(10000);
    return (data ?? []).map((x) => x.id);
  }

  if (segment === "new") {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(10000);
    return (data ?? []).map((x) => x.id);
  }

  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("user_id")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .not("user_id", "is", null)
    .limit(10000);

  return [...new Set((data ?? []).map((x) => x.user_id).filter(Boolean) as string[])];
}

export async function filterCountByUsers(
  table: string,
  column: string,
  fromISO: string,
  toISO: string,
  userIds: string[] | null,
  createdAtColumn = "created_at",
  extra?: { field: string; op: "eq" | "gte" | "lte"; value: string | number | boolean },
) {
  const query = (supabaseAdmin as any)
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte(createdAtColumn, fromISO)
    .lte(createdAtColumn, toISO);

  if (userIds && userIds.length) {
    query.in(column, userIds);
  }

  if (extra) {
    if (extra.op === "eq") query.eq(extra.field, extra.value);
    if (extra.op === "gte") query.gte(extra.field, extra.value);
    if (extra.op === "lte") query.lte(extra.field, extra.value);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function getUsersRegisteredBetween(fromISO: string, toISO: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,created_at")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: true })
    .limit(10000);

  return data ?? [];
}

export async function getUserActiveDays(userIds: string[], endISO: string) {
  if (!userIds.length) return new Map<string, Set<string>>();

  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("user_id,created_at")
    .in("user_id", userIds)
    .lte("created_at", endISO)
    .limit(50000);

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = map.get(row.user_id) ?? new Set<string>();
    set.add(row.created_at.slice(0, 10));
    map.set(row.user_id, set);
  }

  return map;
}
