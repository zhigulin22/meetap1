import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

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
    ] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select(
          "id,name,phone,role,telegram_verified,avatar_url,bio,country,interests,hobbies,facts,profile_completed,is_blocked,blocked_reason,blocked_until,shadow_banned,created_at,last_post_at",
        )
        .eq("id", userId)
        .single(),
      supabaseAdmin.from("posts").select("id,type,caption,risk_score,moderation_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("comments").select("id,post_id,content,risk_score,moderation_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("event_members").select("event_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
      supabaseAdmin.from("reactions").select("id,reaction_type,post_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("user_sessions").select("id,device_label,last_active_at,created_at,revoked_at").eq("user_id", userId).order("last_active_at", { ascending: false }).limit(20),
      supabaseAdmin.from("reports").select("id,reason,status,content_type,content_id,created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("content_flags").select("id,reason,status,risk_score,content_type,content_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("moderation_actions").select("id,action,reason,metadata,created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("analytics_events").select("id,event_name,path,properties,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    ]);

    if (!profile.data) {
      return fail("User not found", 404);
    }

    return ok({
      user: profile.data,
      activity: {
        posts: posts.data ?? [],
        comments: comments.data ?? [],
        events: events.data ?? [],
        reactions: reactions.data ?? [],
        sessions: sessions.data ?? [],
        analytics: analytics.data ?? [],
      },
      moderation: {
        reports: reports.data ?? [],
        flags: flags.data ?? [],
        actions: moderationLogs.data ?? [],
      },
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
