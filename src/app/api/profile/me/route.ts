import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional().nullable(),
  username: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),
  bio: z.string().trim().max(400).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  university: z.string().trim().max(120).optional().nullable(),
  work: z.string().trim().max(120).optional().nullable(),
  hobbies: z.array(z.string()).optional().nullable(),
  interests: z.array(z.string()).optional().nullable(),
  facts: z.array(z.string()).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  preferences: z
    .object({
      activity: z.string().trim().max(120).optional().nullable(),
      specialty: z.string().trim().max(120).optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
});

const BASE_PROFILE_FIELDS = [
  "id",
  "phone",
  "name",
  "username",
  "email",
  "bio",
  "country",
  "city",
  "telegram_verified",
  "telegram_user_id",
  "last_post_at",
  "xp",
  "level",
  "university",
  "work",
  "hobbies",
  "interests",
  "facts",
  "avatar_url",
  "preferences",
  "personality_profile",
  "personality_updated_at",
  "password_hash",
  "role",
  "is_blocked",
  "blocked_reason",
  "blocked_until",
];

function mapProfile(data: any) {
  if (!data) return null;
  const { password_hash, ...rest } = data;
  return { ...rest, has_password: Boolean(password_hash) };
}

async function getProfileFieldList() {
  const snapshot = await getSchemaSnapshot(["users"]);
  const cols = asSet(snapshot, "users");
  return BASE_PROFILE_FIELDS.filter((f) => cols.has(f)).join(",");
}

export async function GET() {
  try {
    const userId = requireUserId();
    const fields = await getProfileFieldList();
    const [{ data }, postsCount, eventsCount, connectsCount] = await Promise.all([
      supabaseAdmin.from("users").select(fields).eq("id", userId).single(),
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("event_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("connections").select("id", { count: "exact", head: true }).eq("from_user_id", userId),
    ]);

    return ok({
      profile: mapProfile(data),
      stats: {
        posts: postsCount.count ?? 0,
        events: eventsCount.count ?? 0,
        connects: connectsCount.count ?? 0,
      },
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}

async function updateProfile(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.message, 422);
    }

    const snapshot = await getSchemaSnapshot(["users"]);
    const cols = asSet(snapshot, "users");
    if (!cols.size) return fail("Schema not ready", 500);

    const payload = pickExistingColumns(parsed.data ?? {}, cols);
    const fields = await getProfileFieldList();

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select(fields)
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({ profile: mapProfile(data) });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function PATCH(req: Request) {
  return updateProfile(req);
}

export async function PUT(req: Request) {
  return updateProfile(req);
}
