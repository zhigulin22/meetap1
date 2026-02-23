import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";

const allowed = new Set(["like", "connect", "star"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const reactionType = String(body?.reactionType ?? "");

    if (!allowed.has(reactionType)) {
      return fail("Invalid reaction", 422);
    }

    const { data: existing } = await supabaseAdmin
      .from("reactions")
      .select("id")
      .eq("post_id", params.id)
      .eq("user_id", userId)
      .eq("reaction_type", reactionType)
      .maybeSingle();

    if (existing?.id) {
      return fail("Реакция уже поставлена", 409);
    }

    if (reactionType === "connect") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reaction_type", "connect")
        .gte("created_at", start.toISOString());

      if ((count ?? 0) >= 10) {
        return fail("Лимит connect: 10 в день", 429);
      }
    }

    if (reactionType === "like") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reaction_type", "like")
        .gte("created_at", start.toISOString());

      if ((count ?? 0) >= 120) {
        return fail("Дневной лимит лайков достигнут", 429);
      }
    }

    const { error } = await supabaseAdmin.from("reactions").insert({
      post_id: params.id,
      user_id: userId,
      reaction_type: reactionType,
    });

    if (error) {
      return fail(error.message, 500);
    }

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
