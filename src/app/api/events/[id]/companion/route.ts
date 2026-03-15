import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { getSchemaSnapshot } from "@/server/schema-introspect";
import { trackEvent } from "@/server/analytics";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => ({} as { active?: boolean; note?: string }));
    const active = body?.active !== false;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : null;

    const schema = await getSchemaSnapshot(["event_companion_requests"]);
    const hasTable = (schema["event_companion_requests"] ?? []).length > 0;

    if (!hasTable) {
      return fail("Функция поиска компании пока недоступна", 503, {
        code: "DB",
        hint: "Примени миграцию 021_events_experience_revamp.sql",
      });
    }

    if (active) {
      const { error } = await supabaseAdmin
        .from("event_companion_requests")
        .upsert({ event_id: params.id, user_id: userId, status: "active", note }, { onConflict: "event_id,user_id" });

      if (error) return fail(error.message, 500);

      await trackEvent({
        eventName: "events.looking_company",
        userId,
        path: `/events/${params.id}`,
        properties: { eventId: params.id },
      });

      return ok({ ok: true, active: true });
    }

    const { error } = await supabaseAdmin
      .from("event_companion_requests")
      .delete()
      .eq("event_id", params.id)
      .eq("user_id", userId);

    if (error) return fail(error.message, 500);

    return ok({ ok: true, active: false });
  } catch {
    return fail("Unauthorized", 401);
  }
}
