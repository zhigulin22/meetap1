import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { z } from "zod";

const updateSchema = z.object({
  university: z.string().max(120).optional(),
  work: z.string().max(120).optional(),
  hobbies: z.array(z.string()).optional(),
  interests: z.array(z.string()).min(3).optional(),
  facts: z.array(z.string()).length(3).optional(),
  avatar_url: z.string().url().optional(),
});

const PROFILE_FIELDS =
  "id,phone,name,telegram_verified,telegram_user_id,last_post_at,xp,level,university,work,hobbies,interests,facts,avatar_url,personality_profile,personality_updated_at,password_hash,role,is_blocked,blocked_reason,blocked_until";

function mapProfile(data: any) {
  if (!data) return null;
  const { password_hash, ...rest } = data;
  return { ...rest, has_password: Boolean(password_hash) };
}

export async function GET() {
  try {
    const userId = requireUserId();
    const [{ data }, postsCount, eventsCount, connectsCount] = await Promise.all([
      supabaseAdmin.from("users").select(PROFILE_FIELDS).eq("id", userId).single(),
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

export async function PATCH(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.message, 422);
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(parsed.data)
      .eq("id", userId)
      .select(PROFILE_FIELDS)
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({ profile: mapProfile(data) });
  } catch {
    return fail("Unauthorized", 401);
  }
}
