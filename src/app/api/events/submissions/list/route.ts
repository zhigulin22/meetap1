import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    const userId = requireUserId();
    const { data, error } = await supabaseAdmin
      .from("event_submissions")
      .select("id,title,category,city,starts_at,status,moderation_status,created_at,event_id")
      .eq("creator_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return fail(error.message, 500);
    return ok({ items: data ?? [] });
  } catch {
    return fail("Unauthorized", 401);
  }
}
