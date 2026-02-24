import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = getCurrentUserId();

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!event) {
    return fail("Event not found", 404);
  }

  const [{ data: participants }, { data: myMembership }] = await Promise.all([
    supabaseAdmin
      .from("event_members")
      .select("user_id,users(id,name,avatar_url,interests)")
      .eq("event_id", params.id),
    userId
      ? supabaseAdmin
          .from("event_members")
          .select("id")
          .eq("event_id", params.id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return ok({ event, participants: participants ?? [], joined: Boolean(myMembership?.id) });
}
