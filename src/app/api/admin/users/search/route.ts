import { fail, ok } from "@/lib/http";
import { userSearchSchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { buildRiskProfiles } from "@/server/risk";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = userSearchSchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit") ?? 30,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const { q, limit } = parsed.data;

    let query = supabaseAdmin
      .from("users")
      .select("id,name,phone,telegram_user_id,country,role,is_blocked,shadow_banned,message_limited,blocked_reason,blocked_until,created_at,last_post_at,telegram_verified,profile_completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRe.test(q)) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,id.eq.${q},telegram_user_id.eq.${q}`);
      } else {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,telegram_user_id.eq.${q},country.ilike.%${q}%`);
      }
    }

    const { data: users, error } = await query;
    if (error) return fail(error.message, 500);

    const userIds = (users ?? []).map((u) => u.id);
    if (!userIds.length) return ok({ items: [] });

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [flags, reports, events, riskMap] = await Promise.all([
      supabaseAdmin.from("content_flags").select("user_id,status").in("user_id", userIds),
      supabaseAdmin.from("reports").select("target_user_id,status").in("target_user_id", userIds),
      supabaseAdmin
        .from("analytics_events")
        .select("user_id,event_name,created_at")
        .in("user_id", userIds)
        .gte("created_at", since30d)
        .limit(30000),
      buildRiskProfiles(userIds),
    ]);

    const flagsMap = new Map<string, number>();
    for (const row of flags.data ?? []) {
      if (row.status !== "open") continue;
      if (!row.user_id) continue;
      flagsMap.set(row.user_id, (flagsMap.get(row.user_id) ?? 0) + 1);
    }

    const reportsMap = new Map<string, number>();
    for (const row of reports.data ?? []) {
      if (row.status !== "open") continue;
      if (!row.target_user_id) continue;
      reportsMap.set(row.target_user_id, (reportsMap.get(row.target_user_id) ?? 0) + 1);
    }

    const statsMap = new Map<string, { posts: number; joins: number; connectSent: number; connectReplied: number; lastSeenAt: string | null }>();
    for (const id of userIds) {
      statsMap.set(id, { posts: 0, joins: 0, connectSent: 0, connectReplied: 0, lastSeenAt: null });
    }

    for (const ev of events.data ?? []) {
      const stat = statsMap.get(ev.user_id);
      if (!stat) continue;
      if (!stat.lastSeenAt || ev.created_at > stat.lastSeenAt) stat.lastSeenAt = ev.created_at;
      if (ev.event_name === "post_published_daily_duo" || ev.event_name === "post_published_video") stat.posts += 1;
      if (ev.event_name === "event_joined") stat.joins += 1;
      if (ev.event_name === "connect_sent" || ev.event_name === "connect_clicked") stat.connectSent += 1;
      if (ev.event_name === "connect_replied" || ev.event_name === "first_message_sent") stat.connectReplied += 1;
    }

    return ok({
      items: (users ?? []).map((u) => {
        const stats = statsMap.get(u.id) ?? { posts: 0, joins: 0, connectSent: 0, connectReplied: 0, lastSeenAt: null };
        const risk = riskMap.get(u.id) ?? { riskScore: 0, riskStatus: "low" as const };
        const replyRate = stats.connectSent > 0 ? Number((stats.connectReplied / stats.connectSent).toFixed(3)) : 0;

        return {
          ...u,
          city: u.country ?? null,
          openFlags: flagsMap.get(u.id) ?? 0,
          openReports: reportsMap.get(u.id) ?? 0,
          lastSeenAt: stats.lastSeenAt,
          posts_30d: stats.posts,
          joins_30d: stats.joins,
          connects_sent_30d: stats.connectSent,
          reply_rate: replyRate,
          risk_score: risk.riskScore,
          status: u.is_blocked ? "blocked" : u.shadow_banned ? "shadowbanned" : u.message_limited ? "limited" : "active",
        };
      }),
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
