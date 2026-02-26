import { supabaseAdmin } from "@/supabase/admin";

export type MetricPoint = { date: string; value: number };

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function rangeDays(fromISO: string, toISO: string) {
  const arr: string[] = [];
  const cur = new Date(fromISO);
  const end = new Date(toISO);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    arr.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return arr;
}

export async function fetchEventRows(fromISO: string, toISO: string, names?: string[]) {
  let q = supabaseAdmin
    .from("analytics_events")
    .select("event_name,user_id,properties,created_at")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .limit(120000);
  if (names?.length) q = q.in("event_name", names);
  const { data } = await q;
  return data ?? [];
}

export function makeTrend(rows: Array<{ event_name: string; created_at: string }>, eventNames: string[], fromISO: string, toISO: string): MetricPoint[] {
  const days = rangeDays(fromISO, toISO);
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!eventNames.includes(row.event_name)) continue;
    const d = dayKey(row.created_at);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return days.map((d) => ({ date: d, value: map.get(d) ?? 0 }));
}

export function countBy(rows: Array<{ event_name: string }>) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.event_name, (map.get(r.event_name) ?? 0) + 1);
  return map;
}

export async function getMetricsBlock(kind: string, fromISO: string, toISO: string) {
  const rows = await fetchEventRows(fromISO, toISO);
  const c = countBy(rows as Array<{ event_name: string }>);

  const kpi = (name: string, value: number, subtitle?: string) => ({ name, value, subtitle: subtitle ?? null });

  if (kind === "growth") {
    const reg = c.get("register_started") ?? 0;
    const ver = c.get("telegram_verified") ?? 0;
    const comp = c.get("registration_completed") ?? 0;
    return {
      kpis: [
        kpi("New Users", comp),
        kpi("TG Verify Rate", reg > 0 ? Number((ver / reg).toFixed(3)) : 0),
        kpi("Registration Completion", reg > 0 ? Number((comp / reg).toFixed(3)) : 0),
      ],
      trends: [
        { key: "registrations", points: makeTrend(rows as any, ["register_started", "registration_completed"], fromISO, toISO) },
      ],
      top: [],
    };
  }

  if (kind === "activation") {
    const reg = c.get("registration_completed") ?? 0;
    const profile = c.get("profile_completed") ?? 0;
    const firstPost = c.get("first_post") ?? (c.get("post_published_daily_duo") ?? 0);
    return {
      kpis: [
        kpi("Profile Completed", profile),
        kpi("First Post", firstPost),
        kpi("Profile Completion Rate", reg > 0 ? Number((profile / reg).toFixed(3)) : 0),
      ],
      trends: [{ key: "activation", points: makeTrend(rows as any, ["profile_completed", "first_post"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "engagement") {
    const uniqueUsers = new Set((rows as any[]).map((r) => r.user_id).filter(Boolean)).size;
    return {
      kpis: [
        kpi("Active Users", uniqueUsers),
        kpi("Events per user/day", uniqueUsers > 0 ? Number((rows.length / uniqueUsers).toFixed(2)) : 0),
        kpi("Stickiness Proxy", Number(((c.get("chat_message_sent") ?? 0) / Math.max(1, c.get("register_started") ?? 1)).toFixed(3))),
      ],
      trends: [{ key: "engagement", points: makeTrend(rows as any, ["chat_message_sent", "connect_sent", "event_joined"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "content") {
    return {
      kpis: [
        kpi("Daily Duo", c.get("post_published_daily_duo") ?? c.get("daily_duo_published") ?? 0),
        kpi("Video Posts", c.get("post_published_video") ?? 0),
        kpi("Weekly posters %", 0, "placeholder"),
      ],
      trends: [{ key: "posts", points: makeTrend(rows as any, ["post_published_daily_duo", "post_published_video", "daily_duo_published"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "events") {
    return {
      kpis: [kpi("Event Viewed", c.get("event_viewed") ?? 0), kpi("Event Joined", c.get("event_joined") ?? 0), kpi("Event Attended", c.get("event_attended") ?? 0)],
      trends: [{ key: "events", points: makeTrend(rows as any, ["event_viewed", "event_joined", "event_attended"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "social") {
    const sent = c.get("connect_sent") ?? c.get("connect_clicked") ?? 0;
    const rep = c.get("connect_replied") ?? c.get("first_message_sent") ?? 0;
    const cont = c.get("chat_message_sent") ?? 0;
    return {
      kpis: [
        kpi("Connect Sent", sent),
        kpi("Connect Replied", rep),
        kpi("Continued D+1", cont),
        kpi("Reply Rate", sent > 0 ? Number((rep / sent).toFixed(3)) : 0),
      ],
      trends: [{ key: "social", points: makeTrend(rows as any, ["connect_sent", "connect_replied", "chat_message_sent", "connect_clicked"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "safety") {
    return {
      kpis: [kpi("Reports", c.get("report_created") ?? c.get("report_submitted") ?? 0), kpi("Flags", c.get("flag_created") ?? 0), kpi("Admin Actions", c.get("admin_action") ?? 0)],
      trends: [{ key: "safety", points: makeTrend(rows as any, ["report_created", "flag_created", "admin_action", "report_submitted"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "ai") {
    let cost = 0;
    for (const r of rows as any[]) {
      if (r.event_name === "ai_cost") cost += Number(r.properties?.usd ?? 0);
    }
    return {
      kpis: [kpi("AI Requests", (c.get("ai_face_validate") ?? 0) + (c.get("ai_icebreaker") ?? 0) + (c.get("ai_admin_insights") ?? 0)), kpi("AI Cost", Number(cost.toFixed(3))), kpi("AI Errors", c.get("ai_error") ?? 0)],
      trends: [{ key: "ai", points: makeTrend(rows as any, ["ai_face_validate", "ai_icebreaker", "ai_admin_insights", "ai_error"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "health") {
    return {
      kpis: [kpi("API Errors", c.get("api_error") ?? 0), kpi("Latency p95", 0, "see overview"), kpi("Events/day", Math.round(rows.length / Math.max(1, rangeDays(fromISO, toISO).length)))],
      trends: [{ key: "health", points: makeTrend(rows as any, ["api_error", "admin_test_event"], fromISO, toISO) }],
      top: [],
    };
  }

  return { kpis: [], trends: [], top: [] };
}
