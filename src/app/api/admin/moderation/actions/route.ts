import { moderationActionSchema } from "@/lib/admin-schemas";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "all";

    const [reports, flags, posts, comments, events] = await Promise.all([
      supabaseAdmin.from("reports").select("id,content_type,content_id,reason,status,details,ai_summary,created_at,target_user_id").eq("status", "open").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("content_flags").select("id,content_type,content_id,reason,status,risk_score,ai_explanation,created_at,user_id").eq("status", "open").order("risk_score", { ascending: false }).limit(80),
      supabaseAdmin.from("posts").select("id,user_id,caption,risk_score,moderation_status,created_at").neq("moderation_status", "clean").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("comments").select("id,user_id,post_id,content,risk_score,moderation_status,created_at").neq("moderation_status", "clean").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("events").select("id,title,description,risk_score,moderation_status,created_at").neq("moderation_status", "clean").order("created_at", { ascending: false }).limit(80),
    ]);

    const payload = {
      reports: reports.data ?? [],
      flags: flags.data ?? [],
      riskyContent: {
        posts: posts.data ?? [],
        comments: comments.data ?? [],
        events: events.data ?? [],
      },
    };

    if (type === "reports") return ok({ reports: payload.reports });
    if (type === "flags") return ok({ flags: payload.flags });

    return ok(payload);
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminUserId = await requireAdminUserId();

    const body = await req.json().catch(() => null);
    const parsed = moderationActionSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const input = parsed.data;

    if (input.targetType === "user") {
      if (input.action === "block_user" || input.action === "temporary_ban") {
        const days = Number((input.metadata as any)?.days ?? 7);
        const blockedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("users")
          .update({ is_blocked: true, blocked_reason: input.reason, blocked_until: blockedUntil })
          .eq("id", input.targetId);

        await supabaseAdmin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", input.targetId).is("revoked_at", null);
      }

      if (input.action === "unblock_user") {
        await supabaseAdmin
          .from("users")
          .update({ is_blocked: false, blocked_reason: null, blocked_until: null })
          .eq("id", input.targetId);
      }

      if (input.action === "shadowban") {
        await supabaseAdmin.from("users").update({ shadow_banned: true }).eq("id", input.targetId);
      }

      if (input.action === "warn_user") {
        await supabaseAdmin.from("user_flags").insert({
          user_id: input.targetId,
          source: "admin",
          reason: `Warning: ${input.reason}`,
          severity: "medium",
          status: "open",
        });
      }
    }

    if (input.targetType === "post") {
      if (input.action === "remove_content") {
        await supabaseAdmin
          .from("posts")
          .update({ moderation_status: "removed", removed_reason: input.reason, removed_at: new Date().toISOString(), risk_score: 100 })
          .eq("id", input.targetId);
      }
      if (input.action === "mark_safe") {
        await supabaseAdmin.from("posts").update({ moderation_status: "clean", risk_score: 0 }).eq("id", input.targetId);
      }
    }

    if (input.targetType === "comment") {
      if (input.action === "remove_content") {
        await supabaseAdmin
          .from("comments")
          .update({ moderation_status: "removed", removed_at: new Date().toISOString(), risk_score: 100 })
          .eq("id", input.targetId);
      }
      if (input.action === "mark_safe") {
        await supabaseAdmin.from("comments").update({ moderation_status: "clean", risk_score: 0 }).eq("id", input.targetId);
      }
    }

    if (input.targetType === "event") {
      if (input.action === "remove_content") {
        await supabaseAdmin
          .from("events")
          .update({ moderation_status: "removed", removed_at: new Date().toISOString(), risk_score: 100 })
          .eq("id", input.targetId);
      }
      if (input.action === "mark_safe") {
        await supabaseAdmin.from("events").update({ moderation_status: "clean", risk_score: 0 }).eq("id", input.targetId);
      }
    }

    if (input.targetType === "report") {
      await supabaseAdmin.from("reports").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", input.targetId);
    }

    if (input.targetType === "flag") {
      await supabaseAdmin.from("content_flags").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", input.targetId);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminUserId,
      target_user_id: input.targetType === "user" ? input.targetId : null,
      action: input.action,
      reason: input.reason,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.metadata ?? {}),
      },
    });

    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
