import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { createRiskFlag, detectRiskText, trackEvent } from "@/server/analytics";

const sendSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
const userIdParamSchema = z.string().uuid("Invalid target user");

function buildThreadFilter(userId: string, targetUserId: string) {
  return `and(from_user_id.eq.${userId},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${userId})`;
}

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    const parsedTarget = userIdParamSchema.safeParse(params.userId);
    if (!parsedTarget.success) {
      return fail("Invalid target user", 422);
    }
    const targetUserId = parsedTarget.data;

    if (targetUserId === userId) {
      return fail("Нельзя писать самому себе", 422);
    }

    const [{ data: target }, { data: rows, error }] = await Promise.all([
      supabaseAdmin.from("users").select("id,name,avatar_url").eq("id", targetUserId).maybeSingle(),
      supabaseAdmin
        .from("messages")
        .select("id,from_user_id,to_user_id,content,created_at")
        .or(buildThreadFilter(userId, targetUserId))
        .order("created_at", { ascending: true })
        .limit(400),
    ]);

    if (!target?.id) {
      return fail("User not found", 404);
    }

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      target,
      items: (rows ?? []).map((row) => ({
        ...row,
        is_mine: row.from_user_id === userId,
      })),
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    const parsedTarget = userIdParamSchema.safeParse(params.userId);
    if (!parsedTarget.success) {
      return fail("Invalid target user", 422);
    }
    const targetUserId = parsedTarget.data;

    if (targetUserId === userId) {
      return fail("Нельзя писать самому себе", 422);
    }

    const rate = checkRateLimit(`dm:${userId}`, 40, 60_000);
    if (!rate.ok) {
      return fail("Слишком часто. Попробуй через минуту", 429);
    }

    const body = await req.json().catch(() => null);
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const content = parsed.data.content;

    const { data: target } = await supabaseAdmin.from("users").select("id").eq("id", targetUserId).maybeSingle();
    if (!target?.id) {
      return fail("User not found", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        from_user_id: userId,
        to_user_id: targetUserId,
        event_id: null,
        content,
      })
      .select("id,from_user_id,to_user_id,content,created_at")
      .single();

    if (error || !data) {
      return fail(error?.message ?? "Message send failed", 500);
    }

    await trackEvent({
      eventName: "dm_sent",
      userId,
      path: "/feed",
      properties: { targetUserId },
    });

    const risk = detectRiskText(content);
    if (risk.risky) {
      await createRiskFlag({
        userId,
        source: "dm",
        severity: "high",
        reason: "Potential prohibited content in direct message",
        evidence: content.slice(0, 280),
      });
    }

    return ok({
      item: {
        ...data,
        is_mine: true,
      },
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
