import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";

function isLocked(lastPostAt: string | null) {
  if (!lastPostAt) return true;
  const diff = Date.now() - new Date(lastPostAt).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
}

export async function GET() {
  try {
    const userId = requireUserId();

    const [{ data: me }, { data: posts }, { data: photos }, { data: users }, { data: reactions }] =
      await Promise.all([
        supabaseAdmin.from("users").select("last_post_at").eq("id", userId).single(),
        supabaseAdmin
          .from("posts")
          .select("id,user_id,type,caption,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("photos").select("post_id,kind,url"),
        supabaseAdmin.from("users").select("id,name,avatar_url"),
        supabaseAdmin.from("reactions").select("post_id,reaction_type,user_id"),
      ]);

    const { data: commentRows, error: commentErr } = await supabaseAdmin
      .from("comments")
      .select("post_id");

    if (commentErr && !commentErr.message.toLowerCase().includes("comments")) {
      return fail(commentErr.message, 500);
    }

    const photoMap = new Map<string, { front?: string; back?: string; cover?: string }>();
    for (const p of photos ?? []) {
      const current = photoMap.get(p.post_id) ?? {};
      if (p.kind === "front") current.front = p.url;
      if (p.kind === "back") current.back = p.url;
      if (p.kind === "cover") current.cover = p.url;
      photoMap.set(p.post_id, current);
    }

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));

    const reactionMap = new Map<string, { like: number; connect: number; star: number }>();
    const myMap = new Map<string, { liked: boolean; connected: boolean; starred: boolean }>();

    for (const r of reactions ?? []) {
      const counters = reactionMap.get(r.post_id) ?? { like: 0, connect: 0, star: 0 };
      if (r.reaction_type === "like") counters.like += 1;
      if (r.reaction_type === "connect") counters.connect += 1;
      if (r.reaction_type === "star") counters.star += 1;
      reactionMap.set(r.post_id, counters);

      if (r.user_id === userId) {
        const mine = myMap.get(r.post_id) ?? { liked: false, connected: false, starred: false };
        if (r.reaction_type === "like") mine.liked = true;
        if (r.reaction_type === "connect") mine.connected = true;
        if (r.reaction_type === "star") mine.starred = true;
        myMap.set(r.post_id, mine);
      }
    }

    const commentsCount = new Map<string, number>();
    for (const row of commentRows ?? []) {
      commentsCount.set(row.post_id, (commentsCount.get(row.post_id) ?? 0) + 1);
    }

    const items = (posts ?? []).map((post) => ({
      ...post,
      is_mine: post.user_id === userId,
      user: userMap.get(post.user_id) ?? null,
      photos: photoMap.get(post.id) ?? {},
      reactions: reactionMap.get(post.id) ?? { like: 0, connect: 0, star: 0 },
      viewer: myMap.get(post.id) ?? { liked: false, connected: false, starred: false },
      comments_count: commentsCount.get(post.id) ?? 0,
    }));

    return ok({
      locked: isLocked(me?.last_post_at ?? null),
      items,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
