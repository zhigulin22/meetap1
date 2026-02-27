import { aliasesForCanonical, aliasesForCanonicals, canonicalizeEventName } from "@/server/event-dictionary";

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

function makeTrend(rows: Array<{ event_name: string; created_at: string }>, canonicalNames: string[], fromISO: string, toISO: string): MetricPoint[] {
  const days = rangeDays(fromISO, toISO);
  const map = new Map<string, number>();
  const canonicalSet = new Set(canonicalNames);
  for (const row of rows) {
    if (!canonicalSet.has(canonicalizeEventName(row.event_name))) continue;
    const d = dayKey(row.created_at);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return days.map((d: any) => ({ date: d, value: map.get(d) ?? 0 }));
}

function countByCanonical(rows: Array<{ event_name: string }>) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = canonicalizeEventName(r.event_name);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function kpi(name: string, value: number, subtitle?: string) {
  return { name, value, subtitle: subtitle ?? null };
}

export async function getMetricsBlock(kind: string, fromISO: string, toISO: string) {
  const rows = await fetchEventRows(fromISO, toISO);
  const c = countByCanonical(rows as Array<{ event_name: string }>);

  if (kind === "growth") {
    const reg = c.get("register_started") ?? 0;
    const ver = c.get("telegram_verified") ?? 0;
    const comp = c.get("registration_completed") ?? 0;
    const profile = c.get("profile_completed") ?? 0;
    return {
      kpis: [
        kpi("New Users", comp),
        kpi("TG Verify Rate", reg > 0 ? Number((ver / reg).toFixed(4)) : 0),
        kpi("Registration Completion", reg > 0 ? Number((comp / reg).toFixed(4)) : 0),
        kpi("Profile Completion", comp > 0 ? Number((profile / comp).toFixed(4)) : 0),
      ],
      trends: [{ key: "growth", points: makeTrend(rows as any, ["register_started", "telegram_verified", "registration_completed"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "activation") {
    const reg = c.get("registration_completed") ?? 0;
    const profile = c.get("profile_completed") ?? 0;
    const firstPost = (c.get("post_published_daily_duo") ?? 0) + (c.get("post_published_video") ?? 0);
    const firstEventJoin = c.get("event_joined") ?? 0;
    return {
      kpis: [
        kpi("Profile Completed", profile),
        kpi("First Post", firstPost),
        kpi("First Event Join", firstEventJoin),
        kpi("Profile Completion Rate", reg > 0 ? Number((profile / reg).toFixed(4)) : 0),
      ],
      trends: [{ key: "activation", points: makeTrend(rows as any, ["profile_completed", "post_published_daily_duo", "post_published_video", "event_joined"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "engagement") {
    const uniqueUsers = new Set((rows as any[]).map((r: any) => r.user_id).filter(Boolean)).size;
    const totalEvents = rows.length;
    return {
      kpis: [
        kpi("Active Users", uniqueUsers),
        kpi("Events/day", Number((totalEvents / Math.max(1, rangeDays(fromISO, toISO).length)).toFixed(2))),
        kpi("Events per user", uniqueUsers > 0 ? Number((totalEvents / uniqueUsers).toFixed(2)) : 0),
      ],
      trends: [{ key: "engagement", points: makeTrend(rows as any, ["event_viewed", "message_sent", "event_joined", "connect_sent"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "content") {
    const duo = c.get("post_published_daily_duo") ?? 0;
    const video = c.get("post_published_video") ?? 0;
    const activeUsers = new Set((rows as any[]).map((r: any) => r.user_id).filter(Boolean)).size;
    return {
      kpis: [
        kpi("Daily Duo", duo),
        kpi("Video Posts", video),
        kpi("Posts per active user", activeUsers > 0 ? Number(((duo + video) / activeUsers).toFixed(3)) : 0),
      ],
      trends: [{ key: "content", points: makeTrend(rows as any, ["post_published_daily_duo", "post_published_video"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "events") {
    const viewed = c.get("event_viewed") ?? 0;
    const joined = c.get("event_joined") ?? 0;
    return {
      kpis: [
        kpi("Event Viewed", viewed),
        kpi("Event Joined", joined),
        kpi("Join Rate", viewed > 0 ? Number((joined / viewed).toFixed(4)) : 0),
      ],
      trends: [{ key: "events", points: makeTrend(rows as any, ["event_viewed", "event_joined"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "social") {
    const sent = c.get("connect_sent") ?? 0;
    const rep = c.get("connect_replied") ?? 0;
    const msgs = c.get("message_sent") ?? 0;
    return {
      kpis: [
        kpi("Connect Sent", sent),
        kpi("Connect Replied", rep),
        kpi("Reply Rate", sent > 0 ? Number((rep / sent).toFixed(4)) : 0),
        kpi("WMC", msgs),
      ],
      trends: [{ key: "social", points: makeTrend(rows as any, ["connect_sent", "connect_replied", "message_sent"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "safety") {
    const reports = c.get("report_created") ?? 0;
    const flags = 0;
    return {
      kpis: [kpi("Reports", reports), kpi("Flags", flags), kpi("Report/Flag Ratio", flags > 0 ? Number((reports / flags).toFixed(4)) : reports > 0 ? 1 : 0)],
      trends: [{ key: "safety", points: makeTrend(rows as any, ["report_created"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "ai") {
    let cost = 0;
    let requests = 0;
    let errors = 0;
    const aiRequestAliases = aliasesForCanonicals(["ai_cost", "ai_error", "ai_face_validate", "ai_icebreaker", "ai_admin_insights"]);
    const aliasSet = new Set(aiRequestAliases);

    for (const r of rows as any[]) {
      if (!aliasSet.has(r.event_name)) continue;
      const canonical = canonicalizeEventName(r.event_name);
      if (canonical === "ai_cost") {
        cost += Number(r.properties?.usd ?? 0);
        requests += 1;
      } else if (canonical === "ai_error") {
        errors += 1;
      } else if (r.event_name.startsWith("ai_")) {
        requests += 1;
      }
    }

    return {
      kpis: [
        kpi("AI Requests", requests),
        kpi("AI Cost", Number(cost.toFixed(4))),
        kpi("AI Error Rate", requests > 0 ? Number((errors / requests).toFixed(4)) : 0),
      ],
      trends: [{ key: "ai", points: makeTrend(rows as any, ["ai_cost", "ai_error"], fromISO, toISO) }],
      top: [],
    };
  }

  if (kind === "health") {
    const apiErr = c.get("api_error") ?? 0;
    const totalDays = Math.max(1, rangeDays(fromISO, toISO).length);
    const eventsPerDay = Number((rows.length / totalDays).toFixed(2));

    return {
      kpis: [
        kpi("API Errors", apiErr),
        kpi("Events/day", eventsPerDay),
        kpi("Data Pipeline", rows.length > 0 ? 1 : 0, rows.length > 0 ? "ok" : "no events"),
      ],
      trends: [{ key: "health", points: makeTrend(rows as any, ["admin_test_event", "api_error", "ai_error"], fromISO, toISO) }],
      top: [],
    };
  }

  return { kpis: [], trends: [], top: [] };
}

export function eventAliasesForFunnelStep(step: string) {
  if (step === "register_started") return aliasesForCanonical("register_started");
  if (step === "telegram_verified") return aliasesForCanonical("telegram_verified");
  if (step === "registration_completed") return aliasesForCanonical("registration_completed");
  if (step === "profile_completed") return aliasesForCanonical("profile_completed");
  if (step === "first_post") return aliasesForCanonicals(["post_published_daily_duo", "post_published_video"]);
  if (step === "event_joined") return aliasesForCanonical("event_joined");
  if (step === "connect_replied") return aliasesForCanonical("connect_replied");
  return [step];
}
