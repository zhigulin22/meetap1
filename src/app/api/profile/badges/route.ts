import { fail, ok } from "@/lib/http";
import { getCurrentUserId, requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  const currentUserId = getCurrentUserId();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? currentUserId;

  if (!userId) return fail("Unauthorized", 401);

  const [allBadges, userBadges, privacyRes] = await Promise.all([
    supabaseAdmin.from("badges").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabaseAdmin
      .from("user_badges")
      .select("id,user_id,badge_id,earned_at,is_featured,badges(*)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false }),
    supabaseAdmin.from("user_privacy_settings").select("show_badges").eq("user_id", userId).maybeSingle(),
  ]);

  const showBadges = privacyRes.data?.show_badges ?? true;
  if (!showBadges && currentUserId !== userId) {
    return ok({ featured: null, earned: [], available: [] });
  }

  const earned = (userBadges.data ?? []).map((row: any) => ({
    id: row.id,
    earned_at: row.earned_at,
    is_featured: row.is_featured,
    badge: Array.isArray(row.badges) ? row.badges[0] : row.badges,
  }));

  const earnedIds = new Set(earned.map((x: any) => x.badge?.id).filter(Boolean));
  const available = (allBadges.data ?? []).filter((b: any) => !earnedIds.has(b.id));
  const featured = earned.find((x: any) => x.is_featured) ?? null;

  return ok({ featured, earned, available });
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const badgeId = String(body?.badgeId ?? "");
    if (!badgeId) return fail("badgeId required", 422);

    const { error } = await supabaseAdmin.from("user_badges").upsert({ user_id: userId, badge_id: badgeId }, { onConflict: "user_id,badge_id" });
    if (error) return fail(error.message, 500);

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
