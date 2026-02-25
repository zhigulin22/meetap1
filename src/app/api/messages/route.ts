import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    const me = requireUserId();

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("id, from_user_id, to_user_id, content, created_at")
      .or(`from_user_id.eq.${me},to_user_id.eq.${me}`)
      .is("event_id", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return fail(error.message);

    const seen = new Set<string>();
    const convos: Array<{ userId: string; lastMessage: NonNullable<typeof data>[0] }> = [];

    for (const msg of data ?? []) {
      const partnerId = msg.from_user_id === me ? msg.to_user_id! : msg.from_user_id;
      if (partnerId && !seen.has(partnerId)) {
        seen.add(partnerId);
        convos.push({ userId: partnerId, lastMessage: msg });
      }
    }

    const ids = convos.map((c) => c.userId);
    const { data: users } = ids.length
      ? await supabaseAdmin.from("users").select("id, name, avatar_url").in("id", ids)
      : { data: [] };

    const umap = new Map((users ?? []).map((u: any) => [u.id, u]));

    return ok({
      conversations: convos.map((c) => ({
        user: umap.get(c.userId) ?? { id: c.userId, name: "Пользователь", avatar_url: null },
        lastMessage: c.lastMessage,
      })),
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
