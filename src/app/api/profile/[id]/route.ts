import { fail, ok } from "@/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

type PostRow = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
};

const defaultPrivacy = {
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

function buildPositiveFact(input: { postsCount: number; eventsCount: number; endorsements: number; recentActive: boolean }) {
  if (input.endorsements >= 15) return "Часто получает положительные отметки после встреч";
  if (input.postsCount >= 20) return "Стабильно делится контентом и поддерживает сообщество";
  if (input.eventsCount >= 8) return "Активно ходит на офлайн встречи";
  if (input.recentActive) return "Регулярно заходит и поддерживает ритм общения";
  return "Открыт(а) к новым знакомствам и нетворкингу";
}

function toObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, any>) : {};
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const clean = phone.replace(/\s/g, "");
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const viewerId = getCurrentUserId();

  const { data: profile } = await supabaseAdmin.from("users").select("*").eq("id", params.id).single();

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
    supabaseAdmin.from("photos").select("post_id,kind,url").eq("user_id", params.id),
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

  const privacyRow = (privacyRes.data as Record<string, any> | null) ?? defaultPrivacy;
  const privacyJson = toObject(profile.privacy_settings);

  const isOwner = viewerId === params.id;
  const showInterests = isOwner || privacyJson.showInterests !== false;
  const showFacts = isOwner || Boolean(privacyRow.show_facts);
  const showCity = isOwner || Boolean(privacyRow.show_city);
  const showUniversity = isOwner || Boolean(privacyRow.show_university);
  const showWork = isOwner || Boolean(privacyRow.show_work);
  const showEventHistory = isOwner || Boolean(privacyRow.show_event_history);
  const showBadges = isOwner || Boolean(privacyRow.show_badges);
  const showLastActive = isOwner || Boolean(privacyRow.show_last_active);

  const phoneVisibility =
    typeof privacyJson.phoneVisibility === "string"
      ? privacyJson.phoneVisibility
      : privacyRow.show_phone
        ? "everyone"
        : "nobody";

  const canShowPhone =
    isOwner ||
    phoneVisibility === "everyone" ||
    (phoneVisibility === "contacts" && Boolean(viewerId));

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

  const featuredBadge = showBadges ? badges.find((x: any) => x.is_featured)?.badge ?? null : null;
  const topBadges = showBadges ? badges.slice(0, 3).map((x: any) => x.badge).filter(Boolean) : [];

  const lastActiveLabel = !showLastActive ? null : recentActive ? "был(а) недавно" : "был(а) на этой неделе";

  return ok({
    profile: {
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      city: showCity ? profile.city ?? null : null,
      country: showCity ? profile.country ?? null : null,
      university: showUniversity ? profile.university ?? null : null,
      work: showWork ? profile.work ?? null : null,
      interests: showInterests ? profile.interests ?? [] : [],
      facts: showFacts ? profile.facts ?? [] : [],
      phone_masked: canShowPhone ? maskPhone(profile.phone) : null,
      level: profile.level,
      lastActiveLabel,
      endorsementsCount,
      featuredBadge,
      topBadges,
      eventHistory: showEventHistory ? (eventsRes.data ?? []) : [],
      eventHistoryCount: eventsCount,
      messagePolicy: privacyRow.who_can_message ?? defaultPrivacy.who_can_message,
    },
    positiveFact,
    content: { all: feed, videos, photos },
  });
}
