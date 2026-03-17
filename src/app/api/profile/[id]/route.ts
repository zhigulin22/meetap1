import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";

const BASE_FIELDS = [
  "id",
  "name",
  "username",
  "bio",
  "country",
  "city",
  "telegram_verified",
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
];

async function getProfileFieldList() {
  const snapshot = await getSchemaSnapshot(["users"]);
  const cols = asSet(snapshot, "users");
  return BASE_FIELDS.filter((f) => cols.has(f)).join(",");
}

function toObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, any>) : {};
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const fields = await getProfileFieldList();
    const { data: profile, error } = await supabaseAdmin
      .from("users")
      .select(fields)
      .eq("id", params.id)
      .limit(1)
      .maybeSingle();

    if (error || !profile) return fail("Профиль не найден", 404);

    const privacyRowRes = await supabaseAdmin.from("user_privacy_settings").select("*").eq("user_id", params.id).maybeSingle();
    const privacyJson = toObject(profile.privacy_settings);

    return ok({
      profile,
      privacy_settings: {
        ...privacyJson,
        show_facts: privacyRowRes.data?.show_facts ?? true,
        show_event_history: privacyRowRes.data?.show_event_history ?? true,
        show_city: privacyRowRes.data?.show_city ?? true,
        show_work: privacyRowRes.data?.show_work ?? true,
        show_university: privacyRowRes.data?.show_university ?? true,
        show_last_active: privacyRowRes.data?.show_last_active ?? true,
        show_badges: privacyRowRes.data?.show_badges ?? true,
      },
    });
  } catch {
    return fail("Not found", 404);
  }
}
