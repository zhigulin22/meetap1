import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { trackEvent } from "@/server/analytics";

const schema = z.object({ toUserId: z.string().uuid() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const fromUserId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    if (parsed.data.toUserId === fromUserId) return fail("Нельзя отметить себя", 422);

    const [fromMembership, toMembership, eventRes] = await Promise.all([
      supabaseAdmin.from("event_members").select("id").eq("event_id", params.id).eq("user_id", fromUserId).maybeSingle(),
      supabaseAdmin.from("event_members").select("id").eq("event_id", params.id).eq("user_id", parsed.data.toUserId).maybeSingle(),
      supabaseAdmin.from("events").select("id,title").eq("id", params.id).single(),
    ]);

    if (!fromMembership.data?.id || !toMembership.data?.id) {
      return fail("Отмечать можно только участников этого события", 403);
    }

    const { error } = await supabaseAdmin.from("event_endorsements").insert({
      event_id: params.id,
      from_user_id: fromUserId,
      to_user_id: parsed.data.toUserId,
    });

    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
        return fail("Вы уже отметили этого участника", 409);
      }
      return fail(error.message, 500);
    }

    const [{ data: fromUser }, { count: endorsementsCount }] = await Promise.all([
      supabaseAdmin.from("users").select("name").eq("id", fromUserId).single(),
      supabaseAdmin
        .from("event_endorsements")
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", parsed.data.toUserId),
    ]);

    await supabaseAdmin.from("notifications").insert({
      user_id: parsed.data.toUserId,
      type: "endorsement",
      title: "Тебя отметили после встречи",
      body: `${fromUser?.name ?? "Участник"} отметил(а) тебя после события ${eventRes.data?.title ?? "Meetap"}`,
      payload: { eventId: params.id, fromUserId, endorsementsCount: endorsementsCount ?? 0 },
    });

    await trackEvent({
      eventName: "endorsement_sent",
      userId: fromUserId,
      path: `/events/${params.id}`,
      properties: { toUserId: parsed.data.toUserId, eventId: params.id },
    });

    return ok({ success: true, endorsementsCount: endorsementsCount ?? 0 });
  } catch {
    return fail("Unauthorized", 401);
  }
}
