import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  country: z.string().max(80).optional(),
  bio: z.string().max(350).optional(),
  university: z.string().max(120).optional(),
  work: z.string().max(120).optional(),
  hobbies: z.array(z.string().max(40)).max(20).optional(),
  interests: z.array(z.string().max(40)).min(3).max(30).optional(),
  facts: z.array(z.string().max(120)).length(3).optional(),
  avatar_url: z.string().url().optional(),
  preferences: z
    .object({
      mode: z.enum(["dating", "networking", "both"]).default("both"),
      intent: z.string().max(120).optional(),
      ageRange: z.tuple([z.number().int().min(18).max(99), z.number().int().min(18).max(99)]).optional(),
      cities: z.array(z.string().max(50)).optional(),
      meetupFrequency: z.enum(["low", "medium", "high"]).default("medium"),
    })
    .optional(),
  privacy_settings: z
    .object({
      showPhone: z.boolean().default(false),
      profileVisibility: z.enum(["public", "members", "connections"]).default("members"),
      allowMessagesFrom: z.enum(["everyone", "verified", "connections"]).default("verified"),
      hideLastSeen: z.boolean().default(false),
      blockedUsers: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  notification_settings: z
    .object({
      likes: z.boolean().default(true),
      comments: z.boolean().default(true),
      events: z.boolean().default(true),
      connections: z.boolean().default(true),
      moderation: z.boolean().default(true),
      weeklyDigest: z.boolean().default(true),
    })
    .optional(),
});

const PROFILE_FIELDS =
  "id,phone,name,telegram_verified,telegram_user_id,last_post_at,xp,level,university,work,hobbies,interests,facts,avatar_url,bio,country,preferences,privacy_settings,notification_settings,profile_completed,personality_profile,personality_updated_at,password_hash,role,is_blocked,blocked_reason,blocked_until,shadow_banned";

function mapProfile(data: any) {
  if (!data) return null;
  const { password_hash, ...rest } = data;
  return { ...rest, has_password: Boolean(password_hash) };
}

export async function GET() {
  try {
    const userId = requireUserId();

    const [profileRes, postsRes, joinsRes, connectionsRes, reactionsRes] = await Promise.all([
      supabaseAdmin.from("users").select(PROFILE_FIELDS).eq("id", userId).single(),
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("event_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("connections").select("id", { count: "exact", head: true }).or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
      supabaseAdmin.from("reactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    return ok({
      profile: mapProfile(profileRes.data),
      activity: {
        posts: postsRes.count ?? 0,
        eventJoins: joinsRes.count ?? 0,
        connections: connectionsRes.count ?? 0,
        reactions: reactionsRes.count ?? 0,
      },
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const payload = parsed.data;

    const interests = payload.interests ?? [];
    const facts = payload.facts ?? [];
    const profileCompleted = interests.length >= 3 && facts.length >= 3 && Boolean(payload.avatar_url ?? true);

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ ...payload, profile_completed: profileCompleted })
      .eq("id", userId)
      .select(PROFILE_FIELDS)
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    if (profileCompleted) {
      await trackEvent({ eventName: "profile.completed", userId, path: "/profile/me" });
    }

    return ok({ profile: mapProfile(data) });
  } catch {
    return fail("Unauthorized", 401);
  }
}
