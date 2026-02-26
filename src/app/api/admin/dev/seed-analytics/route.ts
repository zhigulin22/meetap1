import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const EVENTS = [
  "register_started",
  "telegram_verified",
  "registration_completed",
  "profile_completed",
  "post_published_daily_duo",
  "post_published_video",
  "event_viewed",
  "event_joined",
  "connect_sent",
  "connect_replied",
  "chat_message_sent",
  "report_created",
  "flag_created",
  "ai_cost",
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST() {
  try {
    await requireAdminUserId();

    if (process.env.NODE_ENV === "production") {
      return fail("Seed endpoint disabled in production", 403);
    }

    const { data: users } = await supabaseAdmin.from("users").select("id,created_at").limit(300);
    const userIds = (users ?? []).map((u) => u.id);

    if (!userIds.length) {
      return fail("No users found to seed analytics", 422);
    }

    const now = Date.now();
    const rows: Array<{ event_name: string; user_id: string | null; path: string | null; properties: Record<string, unknown>; created_at: string }> = [];

    for (let d = 0; d < 30; d += 1) {
      const day = new Date(now - d * 24 * 60 * 60 * 1000);
      const baseCount = randomInt(90, 220);

      for (let i = 0; i < baseCount; i += 1) {
        const userId = userIds[randomInt(0, userIds.length - 1)] ?? null;
        const eventName = EVENTS[randomInt(0, EVENTS.length - 1)] ?? "register_started";
        const created = new Date(day.getTime() + randomInt(0, 86399) * 1000).toISOString();

        rows.push({
          event_name: eventName,
          user_id: userId,
          path: eventName.includes("event") ? "/events" : eventName.includes("connect") ? "/contacts" : "/feed",
          properties: {
            device: Math.random() > 0.5 ? "ios" : "android",
            city: ["Moscow", "Dubai", "Tbilisi", "Berlin"][randomInt(0, 3)],
            source: "seed",
            usd: eventName === "ai_cost" ? Number((Math.random() * 0.08).toFixed(4)) : undefined,
          },
          created_at: created,
        });
      }
    }

    for (let i = 0; i < rows.length; i += 800) {
      const chunk = rows.slice(i, i + 800);
      const { error } = await supabaseAdmin.from("analytics_events").insert(chunk);
      if (error) return fail(error.message, 500);
    }

    return ok({ success: true, inserted: rows.length });
  } catch {
    return fail("Forbidden", 403);
  }
}
