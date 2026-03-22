import { fail, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import {
  applyContentModeration,
  createContentFlag,
  createRiskFlag,
  detectRiskText,
  trackEvent,
} from "@/server/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    requireUserId();

    const { data: comments, error } = await supabaseAdmin
      .from("comments")
      .select("id,post_id,user_id,content,created_at,moderation_status")
      .eq("post_id", params.id)
      .neq("moderation_status", "removed")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      if (error.message.toLowerCase().includes("comments")) {
        return ok({ items: [] });
      }
      return fail(error.message, 500);
    }

    const userIds = [...new Set((comments ?? []).map((x: any) => x.user_id))];
    const { data: users } = await supabaseAdmin.from("users").select("id,name,avatar_url").in("id", userIds);
    const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    return ok({
      items: (comments ?? []).map((c: any) => ({
        ...c,
        user: userMap.get(c.user_id) ?? null,
      })),
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const content = String(body?.content ?? "").trim();

    if (!content) {
      return fail("Комментарий пустой", 422);
    }

    if (content.length > 500) {
      return fail("Комментарий слишком длинный", 422);
    }

    const rate = checkRateLimit(`comment:${userId}`, 30, 60_000);
    if (!rate.ok) {
      return fail("Слишком часто. Попробуй через минуту", 429);
    }

    const risk = detectRiskText(content);

    const { data: inserted, error } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: params.id,
        user_id: userId,
        content,
        risk_score: risk.score,
        moderation_status: risk.status,
      })
      .select("id")
      .single();

    if (error) {
      if (error.message.toLowerCase().includes("comments")) {
        return fail("Не применена миграция comments в Supabase", 500);
      }
      return fail(error.message, 500);
    }

    await Promise.all([
      trackEvent({ eventName: "comment.created", userId, path: "/feed", properties: { postId: params.id } }),
      trackEvent({ eventName: "chat.message_sent", userId, path: "/feed", properties: { postId: params.id, source: "comment" } }),
    ]);

    const { count } = await supabaseAdmin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count ?? 0) === 1) {
      await trackEvent({ eventName: "chat.connect_replied", userId, path: "/feed", properties: { postId: params.id } });
    }

    if (risk.risky && inserted?.id) {
      await createRiskFlag({
        userId,
        source: "comment",
        severity: risk.score >= 80 ? "high" : "medium",
        reason: "Potential prohibited content in comment",
        evidence: content.slice(0, 280),
      });

      await createContentFlag({
        contentType: "comment",
        contentId: inserted.id,
        userId,
        source: "rules",
        reason: `Auto-flag by risk patterns: ${risk.patterns.join(", ")}`,
        riskScore: risk.score,
        metadata: { patterns: risk.patterns },
      });

      await applyContentModeration({
        contentType: "comment",
        contentId: inserted.id,
        score: risk.score,
        status: risk.status,
      });
    }

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
