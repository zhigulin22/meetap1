import { fail, ok } from "@/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

type PostRow = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
};

function buildPositiveFact(input: { postsCount: number; eventsCount: number; endorsements: number; recentActive: boolean }) {
  if (input.endorsements >= 15) return "Часто получает положительные отметки после встреч";
  if (input.postsCount >= 20) return "Стабильно делится контентом и поддерживает сообщество";
  if (input.eventsCount >= 8) return "Активно ходит на офлайн встречи";
  if (input.recentActive) return "Регулярно заходит и поддерживает ритм общения";
  return "Открыт(а) к новым знакомствам и нетворкингу";
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const viewerId = getCurrentUserId();

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id,name,avatar_url,bio,country,university,work,hobbies,interests,facts,level,last_post_at,created_at")
    .eq("id", params.id)
    .single();

  if (!profile) {
    return fail("Profile not found", 404);
  }

  const [privacyRes, postsRes, photosRes, eventsRes, endorsementsRes, badgesRes] = await Promise.all([
    supabaseAdmin.from("user_privacy_settings").select("*").eq("user_id", params.id).maybeSingle(),
    supabaseAdmin
      .from("posts")
      .select("id,type,caption,created_at")
      .eq("user_id", params.id)
      .in("moderation_status", ["clean", "limited"])
      .order("created_at", { ascending: false })
      .limit(60),
    supabaseAdmin.from("photos").select("post_id,kind,url"),
    supabaseAdmin
      .from("event_members")
      .select("created_at,event_id,events(id,title,event_date,city)")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabaseAdmin.from("event_endorsements").select("id", { count: "exact", head: true }).eq("to_user_id", params.id),
    supabaseAdmin
      .from("user_badges")
      .select("id,is_featured,badges(id,key,title,description,category,icon)")
      .eq("user_id", params.id)
      .order("earned_at", { ascending: false })
      .limit(12),
  ]);

  const privacy = privacyRes.data ?? {
    show_phone: false,
    show_facts: true,
    show_badges: true,
    show_last_active: true,
    show_event_history: true,
    show_city: true,
    show_work: true,
    show_university: true,
    who_can_message: "shared_events",
  };

  const photoMap = new Map<string, Array<{ kind: string; url: string }>>();
  for (const p of photosRes.data ?? []) {
    const list = photoMap.get(p.post_id) ?? [];
    list.push({ kind: p.kind, url: p.url });
    photoMap.set(p.post_id, list);
  }

  const feed = ((postsRes.data ?? []) as PostRow[]).map((post: any) => ({ ...post, photos: photoMap.get(post.id) ?? [] }));
  const videos = feed.filter((x: any) => x.type === "reel");
  const photos = feed.filter((x: any) => x.type !== "reel");

  const endorsementsCount = endorsementsRes.count ?? 0;
  const eventsCount = (eventsRes.data ?? []).length;
  const recentActive = profile.last_post_at ? Date.now() - new Date(profile.last_post_at).getTime() < 14 * 24 * 60 * 60 * 1000 : false;
  const positiveFact = buildPositiveFact({ postsCount: feed.length, eventsCount, endorsements: endorsementsCount, recentActive });

  const badges = (badgesRes.data ?? []).map((b: any) => ({
    id: b.id,
    is_featured: b.is_featured,
    badge: Array.isArray(b.badges) ? b.badges[0] : b.badges,
  }));

  const featuredBadge = badges.find((x: any) => x.is_featured)?.badge ?? null;
  const topBadges = badges.slice(0, 3).map((x: any) => x.badge).filter(Boolean);

  const lastActiveLabel = !privacy.show_last_active && viewerId !== params.id
    ? null
    : recentActive
      ? "был(а) недавно"
      : "был(а) на этой неделе";

  return ok({
    profile: {
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      country: privacy.show_city || viewerId === params.id ? profile.country : null,
      university: privacy.show_university || viewerId === params.id ? profile.university : null,
      work: privacy.show_work || viewerId === params.id ? profile.work : null,
      interests: profile.interests ?? [],
      facts: privacy.show_facts || viewerId === params.id ? profile.facts ?? [] : [],
      level: profile.level,
      lastActiveLabel,
      endorsementsCount,
      featuredBadge: privacy.show_badges || viewerId === params.id ? featuredBadge : null,
      topBadges: privacy.show_badges || viewerId === params.id ? topBadges : [],
      eventHistory: privacy.show_event_history || viewerId === params.id ? (eventsRes.data ?? []) : [],
      eventHistoryCount: eventsCount,
      messagePolicy: privacy.who_can_message,
    },
    positiveFact,
    content: { all: feed, videos, photos },
  });
}
