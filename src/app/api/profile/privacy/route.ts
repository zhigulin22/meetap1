import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

const privacySchema = z
  .object({
    phone_visibility: z.enum(["nobody", "everyone", "contacts"]).default("nobody"),
    show_facts: z.boolean().default(true),
    show_interests: z.boolean().default(true),
    show_event_history: z.boolean().default(true),
    show_city: z.boolean().default(true),
    show_work: z.boolean().default(true),
    show_university: z.boolean().default(true),
    show_last_active: z.boolean().default(true),
    who_can_message: z.enum(["everyone", "shared_events", "connections"]).default("shared_events"),
    blocked_user_ids: z.array(z.string().uuid()).default([]),
    show_badges: z.boolean().default(true),

    // legacy compatibility
    show_phone: z.boolean().optional(),
  })
  .strict();

const defaults = {
  phone_visibility: "nobody" as const,
  show_facts: true,
  show_interests: true,
  show_event_history: true,
  show_city: true,
  show_work: true,
  show_university: true,
  show_last_active: true,
  who_can_message: "shared_events" as const,
  blocked_user_ids: [] as string[],
  show_badges: true,
};

function toObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, any>) : {};
}

function mergeSettings(row: Record<string, any> | null, privacyJson: Record<string, any>) {
  const phoneVisibility =
    typeof privacyJson.phoneVisibility === "string"
      ? privacyJson.phoneVisibility
      : row?.show_phone
        ? "everyone"
        : defaults.phone_visibility;

  return {
    phone_visibility: phoneVisibility === "contacts" ? "contacts" : phoneVisibility === "everyone" ? "everyone" : "nobody",
    show_facts: row?.show_facts ?? defaults.show_facts,
    show_interests: privacyJson.showInterests ?? defaults.show_interests,
    show_event_history: row?.show_event_history ?? defaults.show_event_history,
    show_city: row?.show_city ?? defaults.show_city,
    show_work: row?.show_work ?? defaults.show_work,
    show_university: row?.show_university ?? defaults.show_university,
    show_last_active: row?.show_last_active ?? defaults.show_last_active,
    who_can_message:
      row?.who_can_message === "everyone" || row?.who_can_message === "connections" || row?.who_can_message === "shared_events"
        ? row.who_can_message
        : defaults.who_can_message,
    blocked_user_ids: Array.isArray(privacyJson.blockedUsers)
      ? privacyJson.blockedUsers.filter((x: unknown) => typeof x === "string")
      : defaults.blocked_user_ids,
    show_badges: row?.show_badges ?? defaults.show_badges,
  };
}

async function loadBlockedUsers(ids: string[]) {
  if (!ids.length) return [] as Array<{ id: string; name: string | null; avatar_url: string | null }>;

  const { data } = await supabaseAdmin.from("users").select("id,name,avatar_url").in("id", ids).limit(100);
  const byId = new Map((data ?? []).map((row: any) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row: any) => ({ id: row.id, name: row.name ?? "Пользователь", avatar_url: row.avatar_url ?? null }));
}

export async function GET() {
  try {
    const userId = requireUserId();

    const [privacyRowRes, userRes] = await Promise.all([
      supabaseAdmin.from("user_privacy_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("users").select("privacy_settings").eq("id", userId).single(),
    ]);

    const privacyJson = toObject(userRes.data?.privacy_settings);
    const settings = mergeSettings((privacyRowRes.data as Record<string, any> | null) ?? null, privacyJson);
    const blockedUsers = await loadBlockedUsers(settings.blocked_user_ids);

    return ok({ settings, blocked_users: blockedUsers });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = requireUserId();

    const body = await req.json().catch(() => null);
    const parsed = privacySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const incoming = parsed.data;

    const [privacyRowRes, userRes] = await Promise.all([
      supabaseAdmin.from("user_privacy_settings").select("show_badges").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("users").select("privacy_settings").eq("id", userId).single(),
    ]);

    const currentPrivacyJson = toObject(userRes.data?.privacy_settings);

    const phoneVisibility = incoming.show_phone === false ? "nobody" : incoming.phone_visibility;

    const rowPayload = {
      user_id: userId,
      show_phone: phoneVisibility !== "nobody",
      show_facts: incoming.show_facts,
      show_badges: incoming.show_badges ?? privacyRowRes.data?.show_badges ?? true,
      show_last_active: incoming.show_last_active,
      show_event_history: incoming.show_event_history,
      show_city: incoming.show_city,
      show_work: incoming.show_work,
      show_university: incoming.show_university,
      who_can_message: incoming.who_can_message,
      updated_at: new Date().toISOString(),
    };

    const { error: rowError } = await supabaseAdmin.from("user_privacy_settings").upsert(rowPayload, { onConflict: "user_id" });
    if (rowError) return fail(rowError.message, 500);

    const nextPrivacyJson = {
      ...currentPrivacyJson,
      phoneVisibility,
      showInterests: incoming.show_interests,
      blockedUsers: incoming.blocked_user_ids,
      allowMessagesFrom: incoming.who_can_message,
      showFacts: incoming.show_facts,
      showEventHistory: incoming.show_event_history,
      showCity: incoming.show_city,
      showWork: incoming.show_work,
      showUniversity: incoming.show_university,
      hideLastSeen: !incoming.show_last_active,
      showBadges: incoming.show_badges,
    };

    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ privacy_settings: nextPrivacyJson })
      .eq("id", userId);

    if (userError) return fail(userError.message, 500);

    const settings = {
      ...incoming,
      phone_visibility: phoneVisibility,
    };

    const blockedUsers = await loadBlockedUsers(settings.blocked_user_ids);
    return ok({ success: true, settings, blocked_users: blockedUsers });
  } catch {
    return fail("Unauthorized", 401);
  }
}
