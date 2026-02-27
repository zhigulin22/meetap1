import { aliasesForMetric, canonicalizeEventName, canonicalsForMetric } from "@/server/event-dictionary";
import { fetchEventRows } from "@/server/metrics-lab";

export type SeriesPoint = { ts: string; value: number };

export function dayRange(fromISO: string, toISO: string) {
  const out: string[] = [];
  const from = new Date(fromISO);
  const to = new Date(toISO);
  from.setUTCHours(0, 0, 0, 0);
  while (from <= to) {
    out.push(from.toISOString().slice(0, 10));
    from.setUTCDate(from.getUTCDate() + 1);
  }
  return out;
}

export async function computeSeries(input: {
  metric: string;
  fromISO: string;
  toISO: string;
  userIds?: string[] | null;
}) {
  const { metric, fromISO, toISO, userIds } = input;
  const filterUsers = userIds && userIds.length ? new Set(userIds) : null;

  if (metric === "tg_verify_rate") {
    const [numRows, denRows] = await Promise.all([
      fetchEventRows(fromISO, toISO, aliasesForMetric("tg_verify_rate_num")),
      fetchEventRows(fromISO, toISO, aliasesForMetric("tg_verify_rate_den")),
    ]);

    const num = new Map<string, number>();
    const den = new Map<string, number>();

    for (const row of numRows) {
      if (filterUsers && (!row.user_id || !filterUsers.has(row.user_id))) continue;
      const d = row.created_at.slice(0, 10);
      num.set(d, (num.get(d) ?? 0) + 1);
    }

    for (const row of denRows) {
      if (filterUsers && (!row.user_id || !filterUsers.has(row.user_id))) continue;
      const d = row.created_at.slice(0, 10);
      den.set(d, (den.get(d) ?? 0) + 1);
    }

    const points = dayRange(fromISO, toISO).map((d: any) => {
      const n = num.get(d) ?? 0;
      const p = den.get(d) ?? 0;
      return { ts: d, value: p > 0 ? Number((n / p).toFixed(4)) : 0 };
    });

    return { metric, from: fromISO, to: toISO, points };
  }

  const rows = await fetchEventRows(fromISO, toISO, aliasesForMetric(metric));

  if (metric === "dau") {
    const dayUsers = new Map<string, Set<string>>();
    const allowedCanonicals = new Set(canonicalsForMetric("dau"));

    for (const row of rows) {
      if (!row.user_id) continue;
      if (filterUsers && !filterUsers.has(row.user_id)) continue;
      if (!allowedCanonicals.has(canonicalizeEventName(row.event_name))) continue;
      const d = row.created_at.slice(0, 10);
      const set = dayUsers.get(d) ?? new Set<string>();
      set.add(row.user_id);
      dayUsers.set(d, set);
    }

    const points = dayRange(fromISO, toISO).map((d: any) => ({ ts: d, value: dayUsers.get(d)?.size ?? 0 }));
    return { metric, from: fromISO, to: toISO, points };
  }

  if (metric === "ai_cost") {
    const dayCost = new Map<string, number>();

    for (const row of rows) {
      if (filterUsers && row.user_id && !filterUsers.has(row.user_id)) continue;
      if (canonicalizeEventName(row.event_name) !== "ai_cost") continue;
      const d = row.created_at.slice(0, 10);
      const usd = Number((row.properties as Record<string, unknown> | null)?.usd ?? 0);
      dayCost.set(d, Number(((dayCost.get(d) ?? 0) + (Number.isFinite(usd) ? usd : 0)).toFixed(4)));
    }

    const points = dayRange(fromISO, toISO).map((d: any) => ({ ts: d, value: dayCost.get(d) ?? 0 }));
    return { metric, from: fromISO, to: toISO, points };
  }

  const allowedCanonicals = new Set(canonicalsForMetric(metric));
  const dayCount = new Map<string, number>();

  for (const row of rows) {
    if (filterUsers && row.user_id && !filterUsers.has(row.user_id)) continue;
    if (!allowedCanonicals.has(canonicalizeEventName(row.event_name))) continue;
    const d = row.created_at.slice(0, 10);
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
  }

  const points = dayRange(fromISO, toISO).map((d: any) => ({ ts: d, value: dayCount.get(d) ?? 0 }));
  return { metric, from: fromISO, to: toISO, points };
}
