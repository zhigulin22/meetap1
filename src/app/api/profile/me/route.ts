import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { z } from "zod";

const preferencesSchema = z
  .object({
    mode: z.enum(["dating", "networking", "both"]).optional(),
    intent: z.string().trim().max(120).optional(),
    meetupFrequency: z.enum(["low", "medium", "high"]).optional(),
    lookingFor: z.array(z.string().trim().max(40)).max(6).optional(),
    activity: z.string().trim().max(120).optional(),
    specialty: z.string().trim().max(120).optional(),
    profileColor: z.string().trim().max(32).optional(),
    profileEmoji: z
      .union([
        z.object({
          type: z.literal("preset"),
          id: z.string().trim().min(1).max(40),
        }),
        z.object({
          type: z.literal("custom"),
          glyph: z.string().trim().min(1).max(2),
          color: z.string().trim().min(3).max(80),
        }),
      ])
      .nullable()
      .optional(),
  })
  .partial();

const notificationsSchema = z
  .object({
    likes: z.boolean().optional(),
    comments: z.boolean().optional(),
    events: z.boolean().optional(),
    connections: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .partial();

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),
    username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
    email: z.string().trim().email().max(160).optional(),
    country: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    bio: z.string().trim().max(320).optional(),
    university: z.string().trim().max(120).optional(),
    work: z.string().trim().max(120).optional(),
    hobbies: z.array(z.string().trim().max(40)).max(20).optional(),
    interests: z.array(z.string().trim().max(40)).min(3).max(30).optional(),
    facts: z.array(z.string().trim().max(120)).min(2).max(3).optional(),
    avatar_url: z.string().url().optional(),
    preferences: preferencesSchema.optional(),
    notification_settings: notificationsSchema.optional(),
  })
  .strict();

function normalizeArray(input?: string[] | null) {
  return (input ?? []).map((x) => x.trim()).filter(Boolean);
}

function mapProfile(data: Record<string, unknown> | null) {
  if (!data) return null;
  const { password_hash: _passwordHash, ...rest } = data;
  return {
    ...rest,
    has_password: Boolean(data.password_hash),
  };
}

async function loadUser(userId: string) {
  const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", userId).single();
  if (error || !data) {
    throw new Error(error?.message ?? "User not found");
  }
  return data as Record<string, unknown>;
}

function pickKnownColumns(existing: Record<string, unknown>, payload: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key in existing) out[key] = value;
  }
  return out;
}

async function getProfileResponse(userId: string) {
  const [profileRes, postsRes, joinsRes, connectionsRes, reactionsRes] = await Promise.all([
    supabaseAdmin.from("users").select("*").eq("id", userId).single(),
    supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("event_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("connections").select("id", { count: "exact", head: true }).or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
    supabaseAdmin.from("reactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    profile: mapProfile((profileRes.data as Record<string, unknown> | null) ?? null),
    activity: {
      posts: postsRes.count ?? 0,
      eventJoins: joinsRes.count ?? 0,
      connections: connectionsRes.count ?? 0,
      reactions: reactionsRes.count ?? 0,
    },
  };
}

export async function GET() {
  try {
    const userId = requireUserId();
    const response = await getProfileResponse(userId);
    return ok(response);
  } catch {
    return fail("Unauthorized", 401);
  }
}

async function updateProfile(req: Request) {
  const userId = requireUserId();
  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }

  const existing = await loadUser(userId);
  const payload = parsed.data;

  const nextInterests = payload.interests ? normalizeArray(payload.interests) : normalizeArray(existing.interests as string[] | null);
  const nextFacts = payload.facts ? normalizeArray(payload.facts) : normalizeArray(existing.facts as string[] | null);
  const nextAvatar = payload.avatar_url ?? (typeof existing.avatar_url === "string" ? existing.avatar_url : null);

  const profileCompleted = Boolean(nextAvatar) && nextInterests.length >= 3 && nextFacts.length >= 2;

  const updatePayload = pickKnownColumns(existing, {
    ...payload,
    interests: payload.interests ? nextInterests : undefined,
    facts: payload.facts ? nextFacts : undefined,
    profile_completed: profileCompleted,
    notification_settings: payload.notification_settings
      ? { ...(existing.notification_settings as Record<string, unknown> | null), ...payload.notification_settings }
      : undefined,
    preferences: payload.preferences ? { ...(existing.preferences as Record<string, unknown> | null), ...payload.preferences } : undefined,
  });

  Object.keys(updatePayload).forEach((key) => {
    if (updatePayload[key] === undefined) delete updatePayload[key];
  });

  const { error } = await supabaseAdmin.from("users").update(updatePayload).eq("id", userId);

  if (error) {
    return fail(error.message, 500);
  }

  if (profileCompleted) {
    await trackEvent({ eventName: "profile.completed", userId, path: "/profile/me" });
  }

  const response = await getProfileResponse(userId);
  return ok(response);
}

export async function PUT(req: Request) {
  try {
    return await updateProfile(req);
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function PATCH(req: Request) {
  try {
    return await updateProfile(req);
  } catch {
    return fail("Unauthorized", 401);
  }
}
