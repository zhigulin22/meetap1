import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireAdminUserId } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (!q || q.length < 2) {
      return ok({ messages: [], comments: [] });
    }

    const [messagesRes, commentsRes] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("id,from_user_id,to_user_id,content,created_at")
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("comments")
        .select("id,user_id,post_id,content,created_at")
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (messagesRes.error) return fail(messagesRes.error.message, 500);
    if (commentsRes.error) return fail(commentsRes.error.message, 500);

    return ok({
      messages: messagesRes.data ?? [],
      comments: commentsRes.data ?? [],
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
