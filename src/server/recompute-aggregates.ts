import { supabaseAdmin } from "@/supabase/admin";
import { canonicalizeEventName } from "@/server/event-dictionary";

export async function recomputeUserStatsDaily(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("user_id,event_name,created_at")
    .gte("created_at", since)
    .not("user_id", "is", null)
    .limit(200000);

  const map = new Map<string, {
    dau: boolean;
    posts: number;
    event_views: number;
    event_joins: number;
    connects_sent: number;
    connects_replied: number;
    msgs_sent: number;
    endorsements_received: number;
    reports_received: number;
  }>();

  for (const row of data ?? []) {
    if (!row.user_id) continue;
    const day = row.created_at.slice(0, 10);
    const key = `${row.user_id}:${day}`;
    const stat = map.get(key) ?? {
      dau: false,
      posts: 0,
      event_views: 0,
      event_joins: 0,
      connects_sent: 0,
      connects_replied: 0,
      msgs_sent: 0,
      endorsements_received: 0,
      reports_received: 0,
    };

    stat.dau = true;
    const canonical = canonicalizeEventName(row.event_name);
    if (canonical === "post_published_daily_duo" || canonical === "post_published_video") stat.posts += 1;
    if (canonical === "event_viewed") stat.event_views += 1;
    if (canonical === "event_joined") stat.event_joins += 1;
    if (canonical === "connect_sent") stat.connects_sent += 1;
    if (canonical === "connect_replied") stat.connects_replied += 1;
    if (canonical === "chat_message_sent") stat.msgs_sent += 1;
    if (canonical === "endorsement_sent") stat.endorsements_received += 1;
    if (canonical === "report_created") stat.reports_received += 1;

    map.set(key, stat);
  }

  const rows = [...map.entries()].map(([key, stat]) => {
    const [user_id, day] = key.split(":");
    return {
      user_id,
      day,
      dau: stat.dau,
      posts: stat.posts,
      event_views: stat.event_views,
      event_joins: stat.event_joins,
      connects_sent: stat.connects_sent,
      connects_replied: stat.connects_replied,
      msgs_sent: stat.msgs_sent,
      endorsements_received: stat.endorsements_received,
      reports_received: stat.reports_received,
    };
  });

  for (let i = 0; i < rows.length; i += 1000) {
    await supabaseAdmin.from("user_stats_daily").upsert(rows.slice(i, i + 1000), { onConflict: "user_id,day" });
  }

  return { rows: rows.length };
}
