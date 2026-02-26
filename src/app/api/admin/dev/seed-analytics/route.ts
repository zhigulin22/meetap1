import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";

const schema = z.object({
  users: z.number().int().min(200).max(2000).default(300),
  days: z.number().int().min(7).max(365).default(30),
  scenario: z.enum(["normal", "spike", "drop"]).default("normal"),
});

const FIRST_NAMES = ["Alex", "Mila", "Ivan", "Nina", "Artem", "Sofia", "Tim", "Daria", "Leo", "Mark", "Sam", "Eva"];
const CITIES = ["Moscow", "Dubai", "Tbilisi", "Berlin", "Warsaw", "Belgrade", "London", "Lisbon"];
const TAGS = ["design", "startup", "music", "sport", "ai", "marketing", "product", "travel", "coffee", "books"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)] as T;
}

function randomPhone() {
  return `+79${randomInt(10, 99)}${randomInt(100, 999)}${randomInt(10, 99)}${randomInt(10, 99)}`;
}

async function ensureUsers(count: number) {
  const { data: existing } = await supabaseAdmin.from("users").select("id,name").limit(count);
  const have = existing?.length ?? 0;
  if (have >= count) return existing ?? [];

  const toCreate = count - have;
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < toCreate; i += 1) {
    const first = pick(FIRST_NAMES);
    const name = `${first} ${String.fromCharCode(65 + (i % 26))}.`;
    const interestCount = randomInt(3, 6);
    const interests = Array.from({ length: interestCount }, () => pick(TAGS));
    rows.push({
      phone: randomPhone(),
      name,
      telegram_verified: Math.random() > 0.18,
      country: pick(CITIES),
      interests,
      hobbies: interests.slice(0, 3),
      facts: ["Люблю офлайн встречи", "Ценю честность", "Открыт к новому"],
      profile_completed: Math.random() > 0.25,
      role: "user",
      level: randomInt(1, 10),
      shadow_banned: Math.random() < 0.03,
    });
  }

  if (rows.length) {
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await supabaseAdmin.from("users").insert(chunk);
    }
  }

  const { data: usersAfter } = await supabaseAdmin.from("users").select("id,name").limit(count);
  return usersAfter ?? [];
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();

    if (process.env.NODE_ENV === "production" && process.env.ADMIN_DEVTOOLS_ENABLED !== "true") {
      return fail("Devtools disabled", 403);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const { users: usersCount, days, scenario } = parsed.data;
    const users = await ensureUsers(usersCount);
    if (!users.length) return fail("No users", 422);

    const superActiveLimit = Math.floor(users.length * 0.2);
    const mediumLimit = Math.floor(users.length * 0.7);

    const rows: Array<{ event_name: string; user_id: string; path: string; properties: Record<string, unknown>; created_at: string }> = [];
    const dailyStats = new Map<string, Record<string, number | boolean>>();

    for (let d = 0; d < days; d += 1) {
      const day = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      const loadFactor = scenario === "spike" ? 1.8 : scenario === "drop" ? 0.5 : 1;

      users.forEach((u, idx) => {
        const activity = idx < superActiveLimit ? 1.4 : idx < mediumLimit ? 0.8 : 0.25;
        const eventsCount = Math.max(0, Math.round(randomInt(1, 12) * activity * loadFactor));
        const key = `${u.id}:${day.toISOString().slice(0, 10)}`;
        const stat = dailyStats.get(key) ?? {
          posts: 0,
          event_views: 0,
          event_joins: 0,
          connects_sent: 0,
          connects_replied: 0,
          msgs_sent: 0,
          endorsements_received: 0,
          reports_received: 0,
          dau: false,
        };

        for (let i = 0; i < eventsCount; i += 1) {
          const catalog = [
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
            "endorsement_sent",
          ] as const;
          let name: string = pick([...catalog]);

          if (Math.random() < 0.02) name = "report_created";
          if (Math.random() < 0.015) name = "flag_created";
          if (Math.random() < 0.02) name = "ai_cost";

          const created = new Date(day.getTime() + randomInt(0, 86399) * 1000).toISOString();
          rows.push({
            event_name: name,
            user_id: u.id,
            path: name.includes("event") ? "/events" : name.includes("connect") ? "/contacts" : "/feed",
            properties: {
              city: pick(CITIES),
              source: "demo_seed",
              usd: name === "ai_cost" ? Number((Math.random() * 0.08).toFixed(4)) : undefined,
            },
            created_at: created,
          });

          stat.dau = true;
          if (name.startsWith("post_published")) stat.posts = Number(stat.posts) + 1;
          if (name === "event_viewed") stat.event_views = Number(stat.event_views) + 1;
          if (name === "event_joined") stat.event_joins = Number(stat.event_joins) + 1;
          if (name === "connect_sent") stat.connects_sent = Number(stat.connects_sent) + 1;
          if (name === "connect_replied") stat.connects_replied = Number(stat.connects_replied) + 1;
          if (name === "chat_message_sent") stat.msgs_sent = Number(stat.msgs_sent) + 1;
          if (name === "endorsement_sent") stat.endorsements_received = Number(stat.endorsements_received) + 1;
          if (name === "report_created") stat.reports_received = Number(stat.reports_received) + 1;
        }

        dailyStats.set(key, stat);
      });
    }

    for (let i = 0; i < rows.length; i += 1000) {
      await supabaseAdmin.from("analytics_events").insert(rows.slice(i, i + 1000));
    }

    const statsRows = [...dailyStats.entries()].map(([key, stat]) => {
      const [user_id, day] = key.split(":");
      return {
        user_id,
        day,
        dau: Boolean(stat.dau),
        posts: Number(stat.posts),
        event_views: Number(stat.event_views),
        event_joins: Number(stat.event_joins),
        connects_sent: Number(stat.connects_sent),
        connects_replied: Number(stat.connects_replied),
        msgs_sent: Number(stat.msgs_sent),
        endorsements_received: Number(stat.endorsements_received),
        reports_received: Number(stat.reports_received),
      };
    });

    try {
      for (let i = 0; i < statsRows.length; i += 1000) {
        await supabaseAdmin.from("user_stats_daily").upsert(statsRows.slice(i, i + 1000), { onConflict: "user_id,day" });
      }
    } catch {
      // ignore if migration 010 not applied yet
    }

    try {
      await supabaseAdmin.from("demo_seed_runs").insert({ run_by: adminId, config: parsed.data });
    } catch {
      // ignore if migration 010 not applied yet
    }
    await logAdminAction({ adminId, action: "demo_seed_run", targetType: "system", meta: parsed.data });

    return ok({ success: true, insertedEvents: rows.length, users: users.length, days });
  } catch {
    return fail("Forbidden", 403);
  }
}
