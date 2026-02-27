import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { buildSingleUserRisk } from "@/server/risk";
import { supabaseAdmin } from "@/supabase/admin";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdminUserId();

    const userId = params.id;

    const [
      profile,
      posts,
      comments,
      events,
      reactions,
      sessions,
      reports,
      flags,
      moderationLogs,
      analytics,
      endorsementsReceived,
      endorsementsSent,
      connectionsSent,
      connectionsReceived,
      messages,
      dailyStats,
      adminAudit,
      risk,
    ] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select(
          "id,name,phone,role,telegram_verified,telegram_user_id,avatar_url,bio,country,interests,hobbies,facts,profile_completed,is_blocked,blocked_reason,blocked_until,shadow_banned,message_limited,created_at,last_post_at",
        )
        .eq("id", userId)
        .single(),
      supabaseAdmin.from("posts").select("id,type,caption,risk_score,moderation_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("comments").select("id,post_id,content,risk_score,moderation_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("event_members").select("event_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("reactions").select("id,reaction_type,post_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("user_sessions").select("id,device_label,last_active_at,created_at,revoked_at").eq("user_id", userId).order("last_active_at", { ascending: false }).limit(50),
      supabaseAdmin.from("reports").select("id,reason,status,content_type,content_id,created_at,reporter_user_id").or(`target_user_id.eq.${userId},reporter_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("content_flags").select("id,reason,status,risk_score,content_type,content_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("moderation_actions").select("id,action,reason,metadata,created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("analytics_events").select("id,event_name,path,properties,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1200),
      supabaseAdmin.from("event_endorsements").select("id,created_at", { count: "exact" }).eq("to_user_id", userId),
      supabaseAdmin.from("event_endorsements").select("id,created_at", { count: "exact" }).eq("from_user_id", userId),
      supabaseAdmin.from("connections").select("id,status,created_at").eq("from_user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("connections").select("id,status,created_at").eq("to_user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("messages").select("id,from_user_id,to_user_id,created_at").or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1200),
      supabaseAdmin.from("user_stats_daily").select("*").eq("user_id", userId).order("day", { ascending: false }).limit(90),
      supabaseAdmin.from("admin_audit_log").select("id,action,target_type,target_id,meta,created_at,admin_id").eq("target_id", userId).order("created_at", { ascending: false }).limit(80),
      buildSingleUserRisk(userId),
    ]);

    if (!profile.data) return fail("User not found", 404);

    const analyticsRows = analytics.data ?? [];

    const heat = new Map<string, number>();
    for (const row of analyticsRows) {
      const key = dayKey(row.created_at);
      heat.set(key, (heat.get(key) ?? 0) + 1);
    }

    const eventsByName = new Map<string, number>();
    for (const row of analyticsRows) {
      eventsByName.set(row.event_name, (eventsByName.get(row.event_name) ?? 0) + 1);
    }

    const videoCount = (posts.data ?? []).filter((p) => p.type === "reel").length;
    const duoCount = (posts.data ?? []).filter((p) => p.type !== "reel").length;

    const msgRows = messages.data ?? [];
    const byPair = new Map<string, string[]>();
    for (const m of msgRows) {
      const peer = m.from_user_id === userId ? m.to_user_id : m.from_user_id;
      const pair = [userId, peer].sort().join(":");
      const list = byPair.get(pair) ?? [];
      list.push(m.created_at);
      byPair.set(pair, list);
    }

    const replyMins: number[] = [];
    for (const times of byPair.values()) {
      const sorted = [...times].sort();
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = new Date(sorted[i - 1]).getTime();
        const cur = new Date(sorted[i]).getTime();
        const deltaMin = Math.max(0, (cur - prev) / 60000);
        if (deltaMin > 0 && deltaMin < 24 * 60) replyMins.push(deltaMin);
      }
    }
    replyMins.sort((a, b) => a - b);
    const medianReplyMin = replyMins.length ? replyMins[Math.floor(replyMins.length / 2)] : 0;

    const timeline = [...analyticsRows]
      .slice(0, 200)
      .map((e) => ({ type: "event", label: e.event_name, created_at: e.created_at, payload: e.properties }));

    return ok({
      user: {
        ...profile.data,
        risk_score: risk.riskScore,
        risk_status: risk.riskStatus,
      },
      summary: {
        postsTotal: (posts.data ?? []).length,
        dailyDuoCount: duoCount,
        videoCount,
        eventViews: eventsByName.get("event_viewed") ?? 0,
        eventJoins: eventsByName.get("event_joined") ?? (events.data?.length ?? 0),
        attended: eventsByName.get("event_attended") ?? 0,
        connectSent: eventsByName.get("connect_sent") ?? 0,
        connectReplied: eventsByName.get("connect_replied") ?? 0,
        continuedD1: eventsByName.get("message_sent") ?? 0,
        messagesCount: msgRows.length,
        medianReplyMin: Number(medianReplyMin.toFixed(1)),
        endorsementsReceived: endorsementsReceived.count ?? 0,
        endorsementsSent: endorsementsSent.count ?? 0,
        reportsReceived: (reports.data ?? []).filter((r) => r.reporter_user_id !== userId).length,
        reportsMade: (reports.data ?? []).filter((r) => r.reporter_user_id === userId).length,
      },
      heatmap: [...heat.entries()].map(([day, value]) => ({ day, value })),
      timeline,
      risk: {
        score: risk.riskScore,
        status: risk.riskStatus,
        signals: risk.signals,
      },
      activity: {
        posts: posts.data ?? [],
        comments: comments.data ?? [],
        events: events.data ?? [],
        reactions: reactions.data ?? [],
        sessions: sessions.data ?? [],
        analytics: analyticsRows,
        messages: msgRows,
        connectionsSent: connectionsSent.data ?? [],
        connectionsReceived: connectionsReceived.data ?? [],
      },
      moderation: {
        reports: reports.data ?? [],
        flags: flags.data ?? [],
        actions: moderationLogs.data ?? [],
      },
      dailyStats: dailyStats.data ?? [],
      adminAudit: adminAudit.data ?? [],
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
