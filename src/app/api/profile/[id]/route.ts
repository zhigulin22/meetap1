import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";

type PostRow = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
};

function buildPositiveFact(input: {
  postsCount: number;
  eventsCount: number;
  likesGiven: number;
  recentActive: boolean;
}) {
  if (input.postsCount >= 20) return "Стабильно делится контентом и поддерживает сообщество";
  if (input.eventsCount >= 8) return "Активно ходит на офлайн встречи и расширяет круг общения";
  if (input.likesGiven >= 50) return "Часто поддерживает людей реакциями и вовлечен в общение";
  if (input.recentActive) return "Регулярно заходит и поддерживает живой ритм общения";
  return "Открыт(а) к новым знакомствам и постепенно развивает профиль";
}

function buildStatus(userId: string, stats: { publications: number; events: number; followers: number }) {
  const statuses = [
    "На волне новых знакомств",
    "Открыт к умным разговорам",
    "Лучше раскрывается офлайн",
    "Нравится активный социальный темп",
    "Предпочитает спокойный формат общения",
    "Любит совместные активности",
  ];

  const hash = [...userId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = statuses[hash % statuses.length];

  if (stats.events >= 5) return `${base} · Часто ходит на события`;
  if (stats.followers >= 20) return `${base} · Быстро находит контакт с людьми`;
  if (stats.publications >= 12) return `${base} · Регулярно делится контентом`;
  return `${base} · Мягкий вход в общение`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id,name,avatar_url,university,work,hobbies,interests,facts,level,xp,created_at,last_post_at")
    .eq("id", params.id)
    .single();

  if (!profile) {
    return fail("Profile not found", 404);
  }

  const [{ data: posts }, { data: photos }, { count: followersCount }, { data: eventRows }, { count: likesGiven }] =
    await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("id,type,caption,created_at")
        .eq("user_id", params.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabaseAdmin.from("photos").select("post_id,kind,url"),
      supabaseAdmin.from("connections").select("id", { count: "exact", head: true }).eq("to_user_id", params.id),
      supabaseAdmin.from("event_members").select("id").eq("user_id", params.id),
      supabaseAdmin
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.id)
        .eq("reaction_type", "like"),
    ]);

  const photoMap = new Map<string, Array<{ kind: string; url: string }>>();
  for (const p of photos ?? []) {
    const list = photoMap.get(p.post_id) ?? [];
    list.push({ kind: p.kind, url: p.url });
    photoMap.set(p.post_id, list);
  }

  const feed = ((posts ?? []) as PostRow[]).map((post) => ({
    ...post,
    photos: photoMap.get(post.id) ?? [],
  }));

  const videos = feed.filter((x) => x.type === "reel");
  const photosOnly = feed.filter((x) => x.type !== "reel");

  const recentActive = profile.last_post_at
    ? Date.now() - new Date(profile.last_post_at).getTime() < 30 * 24 * 60 * 60 * 1000
    : false;

  const stats = {
    followers: followersCount ?? 0,
    publications: feed.length,
    events: (eventRows ?? []).length,
  };

  const positiveFact = buildPositiveFact({
    postsCount: feed.length,
    eventsCount: stats.events,
    likesGiven: likesGiven ?? 0,
    recentActive,
  });

  return ok({
    profile,
    stats,
    status: buildStatus(profile.id, stats),
    positiveFact,
    content: {
      all: feed,
      videos,
      photos: photosOnly,
    },
  });
}
