<<<<<<< HEAD
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

type MessageRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
};

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
      items: ((rows ?? []) as MessageRow[]).map((row) => ({
        ...row,
        is_mine: row.from_user_id === userId,
      })),
    });
=======
import { NextRequest } from "next/server";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { fail, ok } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const me = requireUserId();
    const other = params.userId;

    const [{ data: msgs, error }, { data: user }] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("id, from_user_id, to_user_id, content, created_at")
        .or(
          `and(from_user_id.eq.${me},to_user_id.eq.${other}),and(from_user_id.eq.${other},to_user_id.eq.${me})`,
        )
        .is("event_id", null)
        .order("created_at", { ascending: true })
        .limit(200),
      supabaseAdmin.from("users").select("id, name, avatar_url").eq("id", other).single(),
    ]);

    if (error) return fail(error.message);
    return ok({ messages: msgs ?? [], user, myId: me });
>>>>>>> origin/develop-tema
  } catch {
    return fail("Unauthorized", 401);
  }
}

<<<<<<< HEAD
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
=======
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const me = requireUserId();
    const other = params.userId;
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000) return fail("Invalid message", 422);

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ from_user_id: me, to_user_id: other, content, event_id: null })
      .select("id, from_user_id, to_user_id, content, created_at")
      .single();

    if (error) return fail(error.message);
    return ok({ message: data });
>>>>>>> origin/develop-tema
  } catch {
    return fail("Unauthorized", 401);
  }
}
