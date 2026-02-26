import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { fetchEventRows } from "@/server/metrics-lab";

const schema = z.object({
  metric: z.string().min(2),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
  group_by: z.enum(["day"]).default("day"),
});

const metricMap: Record<string, string[]> = {
  dau: ["chat_message_sent", "connect_sent", "connect_replied", "event_joined", "post_published_daily_duo", "post_published_video"],
  new_users: ["registration_completed"],
  tg_verify_rate_num: ["telegram_verified"],
  tg_verify_rate_den: ["register_started"],
  posts: ["post_published_daily_duo", "post_published_video", "daily_duo_published"],
  connect_replied: ["connect_replied", "first_message_sent"],
  reports: ["report_created"],
  ai_cost: ["ai_cost"],
  events: ["event_viewed", "event_joined"],
};

function days(fromISO: string, toISO: string) {
  const out: string[] = [];
  const cur = new Date(fromISO);
  const end = new Date(toISO);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      metric: searchParams.get("metric") ?? "dau",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
      group_by: searchParams.get("group_by") ?? "day",
    });

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);
    const userIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);

    const m = parsed.data.metric;

    if (m === "tg_verify_rate") {
      const [numRows, denRows] = await Promise.all([
        fetchEventRows(fromISO, toISO, metricMap.tg_verify_rate_num),
        fetchEventRows(fromISO, toISO, metricMap.tg_verify_rate_den),
      ]);

      const num = new Map<string, number>();
      const den = new Map<string, number>();
      for (const r of numRows) {
        if (userIds && r.user_id && !userIds.includes(r.user_id)) continue;
        const d = r.created_at.slice(0, 10);
        num.set(d, (num.get(d) ?? 0) + 1);
      }
      for (const r of denRows) {
        if (userIds && r.user_id && !userIds.includes(r.user_id)) continue;
        const d = r.created_at.slice(0, 10);
        den.set(d, (den.get(d) ?? 0) + 1);
      }

      return ok({
        metric: m,
        from: fromISO,
        to: toISO,
        points: days(fromISO, toISO).map((d) => {
          const n = num.get(d) ?? 0;
          const p = den.get(d) ?? 0;
          return { ts: d, value: p > 0 ? Number((n / p).toFixed(3)) : 0 };
        }),
      });
    }

    const names = metricMap[m] ?? metricMap.posts;
    const rows = await fetchEventRows(fromISO, toISO, names);

    if (m === "dau") {
      const dayUsers = new Map<string, Set<string>>();
      for (const r of rows) {
        if (!r.user_id) continue;
        if (userIds && !userIds.includes(r.user_id)) continue;
        const d = r.created_at.slice(0, 10);
        const set = dayUsers.get(d) ?? new Set<string>();
        set.add(r.user_id);
        dayUsers.set(d, set);
      }

      return ok({
        metric: m,
        from: fromISO,
        to: toISO,
        points: days(fromISO, toISO).map((d) => ({ ts: d, value: dayUsers.get(d)?.size ?? 0 })),
      });
    }

    if (m === "ai_cost") {
      const dayCost = new Map<string, number>();
      for (const r of rows) {
        const d = r.created_at.slice(0, 10);
        const usd = Number((r.properties as Record<string, unknown> | null)?.usd ?? 0);
        dayCost.set(d, Number(((dayCost.get(d) ?? 0) + (Number.isFinite(usd) ? usd : 0)).toFixed(4)));
      }

      return ok({
        metric: m,
        from: fromISO,
        to: toISO,
        points: days(fromISO, toISO).map((d) => ({ ts: d, value: dayCost.get(d) ?? 0 })),
      });
    }

    const dayCount = new Map<string, number>();
    for (const r of rows) {
      if (userIds && r.user_id && !userIds.includes(r.user_id)) continue;
      const d = r.created_at.slice(0, 10);
      dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
    }

    return ok({
      metric: m,
      from: fromISO,
      to: toISO,
      points: days(fromISO, toISO).map((d) => ({ ts: d, value: dayCount.get(d) ?? 0 })),
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
