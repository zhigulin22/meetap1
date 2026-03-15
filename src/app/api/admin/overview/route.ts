import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireAdminUserId } from "@/server/admin";

type AnalyticsRow = {
  event_name: string;
  created_at: string;
};

function getDayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    await requireAdminUserId();

    const now = new Date();
    const d1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersTotalRes,
      dauRes,
      wauRes,
      mauRes,
      posts7Res,
      comments7Res,
      joins7Res,
      openFlagsRes,
      analyticsRes,
      eventsTopRes,
      blockedRes,
    ] = await Promise.all([
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_sessions").select("user_id", { count: "exact", head: true }).gte("last_active_at", d1),
      supabaseAdmin.from("user_sessions").select("user_id", { count: "exact", head: true }).gte("last_active_at", d7),
      supabaseAdmin.from("user_sessions").select("user_id", { count: "exact", head: true }).gte("last_active_at", d30),
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).gte("created_at", d7),
      supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).gte("created_at", d7),
      supabaseAdmin.from("event_members").select("id", { count: "exact", head: true }).gte("created_at", d7),
      supabaseAdmin.from("user_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin.from("analytics_events").select("event_name,created_at").gte("created_at", d14).order("created_at", { ascending: true }),
      supabaseAdmin.from("analytics_events").select("event_name").gte("created_at", d30).limit(5000),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true),
    ]);

    const analytics = (analyticsRes.data ?? []) as AnalyticsRow[];
    const topEvents = (eventsTopRes.data ?? []) as Array<{ event_name: string }>;

    const funnelKeys = [
      "register_started",
      "telegram_verified",
      "registration_completed",
      "login_password",
      "daily_duo_published",
      "like_clicked",
      "connect_clicked",
      "event_join_clicked",
      "comment_sent",
    ];

    const funnelMap = new Map<string, number>();
    for (const k of funnelKeys) funnelMap.set(k, 0);
    for (const row of analytics) {
      if (funnelMap.has(row.event_name)) {
        funnelMap.set(row.event_name, (funnelMap.get(row.event_name) ?? 0) + 1);
      }
    }

    const days: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push(getDayKey(day));
    }

    const seriesMap = new Map<string, { day: string; events: number; registrations: number; moderationFlags: number }>();
    for (const day of days) {
      seriesMap.set(day, { day, events: 0, registrations: 0, moderationFlags: 0 });
    }

    for (const row of analytics) {
      const key = row.created_at.slice(0, 10);
      const bucket = seriesMap.get(key);
      if (!bucket) continue;
      bucket.events += 1;
      if (row.event_name === "registration_completed") bucket.registrations += 1;
    }

    const { data: flags14 } = await supabaseAdmin.from("user_flags").select("created_at").gte("created_at", d14);
    for (const f of flags14 ?? []) {
      const key = f.created_at.slice(0, 10);
      const bucket = seriesMap.get(key);
      if (!bucket) continue;
      bucket.moderationFlags += 1;
    }

    const eventCounter = new Map<string, number>();
    for (const e of topEvents) {
      eventCounter.set(e.event_name, (eventCounter.get(e.event_name) ?? 0) + 1);
    }

    const topButtons = [...eventCounter.entries()]
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 12)
      .map(([eventName, count]) => ({ eventName, count }));

    return ok({
      kpis: {
        usersTotal: usersTotalRes.count ?? 0,
        dau: dauRes.count ?? 0,
        wau: wauRes.count ?? 0,
        mau: mauRes.count ?? 0,
        posts7d: posts7Res.count ?? 0,
        comments7d: comments7Res.count ?? 0,
        eventJoins7d: joins7Res.count ?? 0,
        openFlags: openFlagsRes.count ?? 0,
        blockedUsers: blockedRes.count ?? 0,
      },
      funnel: funnelKeys.map((key: any) => ({ key, count: funnelMap.get(key) ?? 0 })),
      series: [...seriesMap.values()],
      topButtons,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
