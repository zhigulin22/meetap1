import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  show_phone: z.boolean(),
  show_facts: z.boolean(),
  show_badges: z.boolean(),
  show_last_active: z.boolean(),
  show_event_history: z.boolean(),
  show_city: z.boolean(),
  show_work: z.boolean(),
  show_university: z.boolean(),
  who_can_message: z.enum(["everyone", "shared_events", "connections", "verified"]),
});

const defaults = {
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

export async function GET() {
  try {
    const userId = requireUserId();
    const { data } = await supabaseAdmin.from("user_privacy_settings").select("*").eq("user_id", userId).maybeSingle();
    return ok({ settings: data ?? { user_id: userId, ...defaults } });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const payload = {
      user_id: userId,
      ...parsed.data,
      who_can_message: parsed.data.who_can_message === "verified" ? "shared_events" : parsed.data.who_can_message,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from("user_privacy_settings").upsert(payload, { onConflict: "user_id" });
    if (error) return fail(error.message, 500);

    await supabaseAdmin
      .from("users")
      .update({
        privacy_settings: {
          showPhone: payload.show_phone,
          showFacts: payload.show_facts,
          showBadges: payload.show_badges,
          showLastActive: payload.show_last_active,
          showEventHistory: payload.show_event_history,
          showCity: payload.show_city,
          showWork: payload.show_work,
          showUniversity: payload.show_university,
          allowMessagesFrom: payload.who_can_message,
        },
      })
      .eq("id", userId);

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
