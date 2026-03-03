import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({ badgeId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const owned = await supabaseAdmin
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", parsed.data.badgeId)
      .maybeSingle();

    if (owned.error) return fail(owned.error.message, 500);
    if (!owned.data) return fail("Сначала нужно получить этот бейдж", 422);

    await supabaseAdmin.from("user_badges").update({ is_featured: false }).eq("user_id", userId);
    const { error } = await supabaseAdmin
      .from("user_badges")
      .update({ is_featured: true })
      .eq("user_id", userId)
      .eq("badge_id", parsed.data.badgeId);

    if (error) return fail(error.message, 500);
    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
