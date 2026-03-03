import { fail, ok } from "@/lib/http";
import { getCurrentUserId, requireUserId } from "@/server/auth";
import { loadBadgesForUser, recomputeBadgesForUser } from "@/server/badges-progress";
import { supabaseAdmin } from "@/supabase/admin";

const CATEGORY_ORDER = [
  "Получено",
  "Социальные связи",
  "Мероприятия",
  "Контент",
  "Стабильность",
  "Комьюнити",
  "Сезонные миссии",
] as const;

export async function GET(req: Request) {
  const currentUserId = getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? currentUserId;

  if (!userId) return fail("Unauthorized", 401);

  const privacyRes = await supabaseAdmin.from("user_privacy_settings").select("show_badges").eq("user_id", userId).maybeSingle();
  const showBadges = privacyRes.data?.show_badges ?? true;

  if (!showBadges && currentUserId !== userId) {
    return ok({
      featured: null,
      earnedCount: 0,
      totalCount: 0,
      categories: CATEGORY_ORDER,
      items: [],
    });
  }

  const payload = currentUserId === userId ? await recomputeBadgesForUser(userId) : await loadBadgesForUser(userId);

  const sortedItems = [...payload.items].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const rarityRank = { legendary: 4, epic: 3, rare: 2, common: 1 } as const;
    if (rarityRank[a.rarity] !== rarityRank[b.rarity]) return rarityRank[b.rarity] - rarityRank[a.rarity];
    if (a.category !== b.category) return a.category.localeCompare(b.category, "ru");
    if (a.tier !== b.tier) return b.tier - a.tier;
    return a.title.localeCompare(b.title, "ru");
  });

  return ok({
    featured: payload.featured,
    earnedCount: payload.earnedCount,
    totalCount: payload.totalCount,
    categories: CATEGORY_ORDER,
    items: sortedItems,
  });
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const badgeId = String(body?.badgeId ?? "");
    if (!badgeId) return fail("badgeId required", 422);

    const { error } = await supabaseAdmin.from("user_badges").upsert({ user_id: userId, badge_id: badgeId }, { onConflict: "user_id,badge_id" });
    if (error) return fail(error.message, 500);

    const next = await recomputeBadgesForUser(userId);
    return ok({ success: true, earnedCount: next.earnedCount });
  } catch {
    return fail("Unauthorized", 401);
  }
}
