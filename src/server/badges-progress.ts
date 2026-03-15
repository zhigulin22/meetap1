import { buildBadgeCatalog, ensureBadgeCatalog } from "@/server/badges-catalog";
import { supabaseAdmin } from "@/supabase/admin";

type AnalyticsRow = {
  event_name: string;
  created_at: string;
  properties: Record<string, any> | null;
};

type UserBadgeRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_featured: boolean;
  progress?: Record<string, any> | null;
};

type ProgressRow = {
  current: number;
  target: number;
  percent: number;
  metric: string;
  updated_at: string;
};

export type BadgeWithProgress = {
  id: string;
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  tier: number;
  rules: Record<string, any>;
  earned: boolean;
  earned_at: string | null;
  is_featured: boolean;
  progress: ProgressRow;
};

const ALIASES = {
  connect_sent: ["connect_sent", "chat.connect_sent"],
  connect_replied: ["connect_replied", "chat.connect_replied"],
  message_sent: ["chat_message_sent", "message_sent", "chat.message_sent"],
  event_viewed: ["event_viewed", "events.viewed"],
  event_joined: ["event_joined", "events.joined"],
  post_duo: ["post_published_daily_duo", "feed.post_published_daily_duo"],
  post_video: ["post_published_video", "feed.post_published_video"],
  comment_created: ["comment_created", "comment.created"],
  session_start: ["app.session_start", "session_start"],
  profile_updated: ["profile_updated", "profile_completed", "profile.completed"],
};

function normalizeEventName(name: string | null | undefined) {
  return String(name ?? "").trim().toLowerCase();
}

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return message.includes("column") && message.includes(column.toLowerCase()) && message.includes("does not exist");
}

function weekKey(dateIso: string) {
  const date = new Date(dateIso);
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const d = new Date(utc);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthKey(dateIso: string) {
  const date = new Date(dateIso);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayKey(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10);
}

function countByAliases(rows: AnalyticsRow[], aliases: string[]) {
  const normalized = new Set(aliases.map(normalizeEventName));
  return rows.reduce((acc, row) => (normalized.has(normalizeEventName(row.event_name)) ? acc + 1 : acc), 0);
}

async function loadAnalyticsRows(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("event_name,created_at,properties")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50000);

  if (error) return [] as AnalyticsRow[];
  return (data ?? []) as AnalyticsRow[];
}

async function loadPosts(userId: string) {
  const { data, error } = await supabaseAdmin.from("posts").select("type,created_at").eq("user_id", userId).limit(20000);
  if (error) return [] as Array<{ type: string; created_at: string }>;
  return (data ?? []) as Array<{ type: string; created_at: string }>;
}

async function loadEventMembers(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("event_members")
    .select("event_id,created_at,events(city)")
    .eq("user_id", userId)
    .limit(20000);

  if (error) return [] as Array<{ event_id: string; created_at: string; events: any }>;
  return (data ?? []) as Array<{ event_id: string; created_at: string; events: any }>;
}

async function loadEndorsements(userId: string) {
  const { data, error } = await supabaseAdmin.from("event_endorsements").select("from_user_id,created_at").eq("to_user_id", userId).limit(20000);
  if (error) return [] as Array<{ from_user_id: string; created_at: string }>;
  return (data ?? []) as Array<{ from_user_id: string; created_at: string }>;
}

function computeMetricValues(rows: AnalyticsRow[], posts: Array<{ type: string; created_at: string }>, members: Array<{ event_id: string; created_at: string; events: any }>, endorsements: Array<{ from_user_id: string; created_at: string }>) {
  const messageDays = new Set<string>();
  const activeWeeks = new Set<string>();
  const eventWeeks = new Set<string>();
  const activeMonths = new Set<string>();
  const eventCities = new Set<string>();

  for (const row of rows) {
    const eventName = normalizeEventName(row.event_name);
    if (!eventName || eventName.startsWith("admin.") || eventName.startsWith("diagnostics.")) continue;

    activeWeeks.add(weekKey(row.created_at));
    activeMonths.add(monthKey(row.created_at));

    if (ALIASES.message_sent.map(normalizeEventName).includes(eventName)) {
      messageDays.add(dayKey(row.created_at));
    }

    if (ALIASES.event_joined.map(normalizeEventName).includes(eventName)) {
      eventWeeks.add(weekKey(row.created_at));
    }

    if ((ALIASES.event_viewed.map(normalizeEventName).includes(eventName) || ALIASES.event_joined.map(normalizeEventName).includes(eventName)) && row.properties?.city) {
      eventCities.add(String(row.properties.city));
    }
  }

  for (const member of members) {
    if (member.created_at) eventWeeks.add(weekKey(member.created_at));
    const event = Array.isArray(member.events) ? member.events[0] : member.events;
    if (event?.city) eventCities.add(String(event.city));
  }

  const duoPostsFromTable = posts.filter((p) => p.type === "daily_duo").length;
  const videoPostsFromTable = posts.filter((p) => p.type === "reel").length;
  const totalPostsFromTable = posts.length;

  const duoPosts = Math.max(duoPostsFromTable, countByAliases(rows, ALIASES.post_duo));
  const videoPosts = Math.max(videoPostsFromTable, countByAliases(rows, ALIASES.post_video));
  const totalPosts = Math.max(totalPostsFromTable, duoPosts + videoPosts);

  const connectSent = countByAliases(rows, ALIASES.connect_sent);
  const connectReplied = countByAliases(rows, ALIASES.connect_replied);
  const messageSent = countByAliases(rows, ALIASES.message_sent);
  const eventViewed = countByAliases(rows, ALIASES.event_viewed);
  const eventJoined = Math.max(members.length, countByAliases(rows, ALIASES.event_joined));
  const comments = countByAliases(rows, ALIASES.comment_created);
  const sessions = countByAliases(rows, ALIASES.session_start);
  const profileUpdates = countByAliases(rows, ALIASES.profile_updated);

  const endorsementsReceived = endorsements.length;
  const endorsementsUniqueSenders = new Set(endorsements.map((x) => x.from_user_id)).size;

  const communityScore = connectReplied * 2 + endorsementsReceived * 3 + eventJoined + totalPosts;
  const mixedActionsTotal = totalPosts + eventJoined + connectSent + connectReplied + comments + messageSent;

  return {
    connect_sent_total: connectSent,
    connect_replied_total: connectReplied,
    message_sent_total: messageSent,
    event_viewed_total: eventViewed,
    event_joined_total: eventJoined,
    event_unique_cities: eventCities.size,
    event_weeks_active: eventWeeks.size,
    posts_total: totalPosts,
    duo_posts_total: duoPosts,
    video_posts_total: videoPosts,
    comments_created_total: comments,
    active_weeks_total: activeWeeks.size,
    active_months_total: activeMonths.size,
    sessions_total: sessions,
    profile_updates_total: profileUpdates,
    endorsements_received_total: endorsementsReceived,
    endorsements_unique_senders: endorsementsUniqueSenders,
    community_score: communityScore,
    message_days_total: messageDays.size,
    mixed_actions_total: mixedActionsTotal,
  } satisfies Record<string, number>;
}

async function fetchActiveBadges() {
  const extended = await supabaseAdmin
    .from("badges")
    .select("id,key,title,description,category,icon,rarity,tier,rules,is_active,created_at")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("tier", { ascending: true })
    .order("created_at", { ascending: true });

  if (!extended.error) {
    return (extended.data ?? []).map((row: any) => ({
      ...row,
      rarity: (row.rarity ?? "common") as BadgeWithProgress["rarity"],
      tier: Number(row.tier ?? 1),
    }));
  }

  if (isMissingColumnError(extended.error, "rarity") || isMissingColumnError(extended.error, "tier")) {
    const fallback = await supabaseAdmin
      .from("badges")
      .select("id,key,title,description,category,icon,rules,is_active,created_at")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row: any) => ({
      ...row,
      rarity: "common" as const,
      tier: Number(row?.rules?.tier ?? 1),
    }));
  }

  throw new Error(extended.error.message);
}

async function fetchUserBadges(userId: string) {
  const extended = await supabaseAdmin
    .from("user_badges")
    .select("id,user_id,badge_id,earned_at,is_featured,progress")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (!extended.error) {
    return (extended.data ?? []) as UserBadgeRow[];
  }

  if (isMissingColumnError(extended.error, "progress")) {
    const fallback = await supabaseAdmin
      .from("user_badges")
      .select("id,user_id,badge_id,earned_at,is_featured")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row: any) => ({ ...row, progress: null })) as UserBadgeRow[];
  }

  throw new Error(extended.error.message);
}

async function upsertEarnedBadges(rows: Array<{ user_id: string; badge_id: string; progress: ProgressRow }>) {
  if (!rows.length) return;

  const withProgress = await supabaseAdmin.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id" });
  if (!withProgress.error) return;

  if (isMissingColumnError(withProgress.error, "progress")) {
    const fallback = rows.map((row) => ({ user_id: row.user_id, badge_id: row.badge_id }));
    const withoutProgress = await supabaseAdmin.from("user_badges").upsert(fallback, { onConflict: "user_id,badge_id" });
    if (withoutProgress.error) throw new Error(withoutProgress.error.message);
    return;
  }

  throw new Error(withProgress.error.message);
}

function progressFor(badge: { rules: Record<string, any> }, metrics: Record<string, number>): ProgressRow {
  const metric = String(badge.rules?.metric ?? "");
  const target = Math.max(1, Number(badge.rules?.target ?? 1));
  const current = Math.max(0, Number(metrics[metric] ?? 0));
  const percent = Math.max(0, Math.min(100, Math.round((current / target) * 100)));

  return {
    current,
    target,
    percent,
    metric,
    updated_at: new Date().toISOString(),
  };
}

export async function recomputeBadgesForUser(userId: string) {
  await ensureBadgeCatalog();

  const [catalogRows, analyticsRows, posts, eventMembers, endorsements] = await Promise.all([
    fetchActiveBadges(),
    loadAnalyticsRows(userId),
    loadPosts(userId),
    loadEventMembers(userId),
    loadEndorsements(userId),
  ]);

  const metrics = computeMetricValues(analyticsRows, posts, eventMembers, endorsements);
  const byKey = new Map(buildBadgeCatalog().map((x) => [x.key, x]));

  const earnedRows: Array<{ user_id: string; badge_id: string; progress: ProgressRow }> = [];

  for (const badge of catalogRows) {
    const progress = progressFor(badge, metrics);
    const isEarned = progress.current >= progress.target;

    if (isEarned) {
      earnedRows.push({ user_id: userId, badge_id: badge.id, progress });
    }

    const catalogMeta = byKey.get(badge.key);
    if (catalogMeta) {
      badge.rarity = catalogMeta.rarity;
      badge.tier = catalogMeta.tier;
    }
  }

  await upsertEarnedBadges(earnedRows);

  const userBadges = await fetchUserBadges(userId);
  const earnedByBadgeId = new Map(userBadges.map((x) => [x.badge_id, x]));

  const items: BadgeWithProgress[] = catalogRows.map((badge: any) => {
    const userBadge = earnedByBadgeId.get(badge.id);
    const baseProgress = progressFor(badge, metrics);
    const savedProgress = (userBadge?.progress as Record<string, any> | undefined) ?? null;

    const resolvedProgress: ProgressRow = {
      current: Number(savedProgress?.current ?? baseProgress.current),
      target: Number(savedProgress?.target ?? baseProgress.target),
      percent: Number(savedProgress?.percent ?? baseProgress.percent),
      metric: String(savedProgress?.metric ?? baseProgress.metric),
      updated_at: String(savedProgress?.updated_at ?? baseProgress.updated_at),
    };

    return {
      id: badge.id,
      key: badge.key,
      title: badge.title,
      description: badge.description,
      category: badge.category,
      icon: badge.icon || "Medal",
      rarity: (badge.rarity ?? "common") as BadgeWithProgress["rarity"],
      tier: Number(badge.tier ?? 1),
      rules: (badge.rules as Record<string, any>) ?? {},
      earned: Boolean(userBadge),
      earned_at: userBadge?.earned_at ?? null,
      is_featured: Boolean(userBadge?.is_featured),
      progress: resolvedProgress,
    };
  });

  const feature = items.find((x) => x.is_featured) ?? null;

  return {
    items,
    featured: feature,
    earnedCount: items.filter((x) => x.earned).length,
    totalCount: items.length,
    metrics,
  };
}

export async function loadBadgesForUser(userId: string) {
  await ensureBadgeCatalog();

  const [catalogRows, userBadges] = await Promise.all([fetchActiveBadges(), fetchUserBadges(userId)]);
  const earnedByBadgeId = new Map(userBadges.map((x) => [x.badge_id, x]));

  const items: BadgeWithProgress[] = catalogRows.map((badge: any) => {
    const userBadge = earnedByBadgeId.get(badge.id);
    const target = Math.max(1, Number((badge.rules as any)?.target ?? 1));
    const savedProgress = (userBadge?.progress as Record<string, any> | undefined) ?? null;
    const current = Number(savedProgress?.current ?? 0);

    return {
      id: badge.id,
      key: badge.key,
      title: badge.title,
      description: badge.description,
      category: badge.category,
      icon: badge.icon || "Medal",
      rarity: (badge.rarity ?? "common") as BadgeWithProgress["rarity"],
      tier: Number(badge.tier ?? 1),
      rules: (badge.rules as Record<string, any>) ?? {},
      earned: Boolean(userBadge),
      earned_at: userBadge?.earned_at ?? null,
      is_featured: Boolean(userBadge?.is_featured),
      progress: {
        current,
        target,
        percent: Math.max(0, Math.min(100, Math.round((current / target) * 100))),
        metric: String(savedProgress?.metric ?? (badge.rules as any)?.metric ?? ""),
        updated_at: String(savedProgress?.updated_at ?? new Date().toISOString()),
      },
    };
  });

  return {
    items,
    featured: items.find((x) => x.is_featured) ?? null,
    earnedCount: items.filter((x) => x.earned).length,
    totalCount: items.length,
  };
}
