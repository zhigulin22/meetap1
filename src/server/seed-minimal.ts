import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/supabase/admin";

const CITIES = ["Moscow", "Dubai", "Tbilisi", "Berlin", "Warsaw", "Belgrade", "London", "Lisbon"];
const NAMES = ["Alex", "Mila", "Ivan", "Nina", "Artem", "Sofia", "Tim", "Daria", "Leo", "Mark", "Sam", "Eva"];
const INTERESTS = ["design", "startup", "music", "sport", "ai", "marketing", "product", "travel", "coffee", "books"];
const ANALYTICS_EVENTS = [
  "auth.register_started",
  "auth.telegram_verified",
  "auth.registration_completed",
  "profile.completed",
  "feed.post_published_daily_duo",
  "feed.post_published_video",
  "events.viewed",
  "events.joined",
  "chat.connect_sent",
  "chat.connect_replied",
  "chat.message_sent",
  "comment.created",
  "safety.report_created",
] as const;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[rnd(0, arr.length - 1)] as T;
}

function chance(probability: number) {
  return Math.random() < probability;
}

function randomPhone() {
  return `+79${rnd(10, 99)}${rnd(100, 999)}${rnd(10, 99)}${rnd(10, 99)}`;
}

function randomInterests(count = 4) {
  const set = new Set<string>();
  while (set.size < count) set.add(pick(INTERESTS));
  return [...set];
}

function isMissingColumnError(message?: string, column?: string) {
  if (!message || !column) return false;
  const m = message.toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

export function getSeedMinimalStatus() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    return {
      enabled: true,
      reason: "development mode",
      fixSteps: [],
    } as const;
  }

  const enabledByEnv = process.env.SEED_MINIMAL_ENABLED === "true";
  if (enabledByEnv) {
    return {
      enabled: true,
      reason: "SEED_MINIMAL_ENABLED=true",
      fixSteps: [],
    } as const;
  }

  return {
    enabled: false,
    reason: "production mode: set SEED_MINIMAL_ENABLED=true",
    fixSteps: [
      "Добавь SEED_MINIMAL_ENABLED=true в Vercel Environment Variables",
      "Сделай redeploy, затем обнови страницу админки",
    ],
  } as const;
}

async function ensureDemoUsers(target = 10) {
  const existingRes = await supabaseAdmin
    .from("users")
    .select("id,name")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(target);

  if (existingRes.error) throw new Error(existingRes.error.message);

  const existing = existingRes.data ?? [];
  if (existing.length >= target) return existing.map((x) => x.id);

  const need = target - existing.length;
  const rows = Array.from({ length: need }).map((_, idx) => {
    const city = pick(CITIES);
    const interests = randomInterests(rnd(3, 5));
    return {
      id: randomUUID(),
      phone: randomPhone(),
      name: `Demo ${pick(NAMES)} ${idx + 1}`,
      telegram_verified: chance(0.72),
      role: "user",
      is_demo: true,
      city,
      country: city,
      interests,
      hobbies: interests.slice(0, 3),
      facts: ["Люблю офлайн-встречи", "Открыт к знакомству", "Уважаю границы"],
      profile_completed: chance(0.7),
      level: rnd(1, 6),
    };
  });

  const insert = await supabaseAdmin.from("users").insert(rows).select("id");
  if (insert.error) throw new Error(insert.error.message);

  return [...existing.map((x) => x.id), ...(insert.data ?? []).map((x) => x.id)].slice(0, target);
}

async function ensureDemoEvents(target = 5) {
  const existingRes = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(target);

  if (existingRes.error) {
    if (isMissingColumnError(existingRes.error.message, "is_demo")) {
      throw new Error("Column events.is_demo is missing. Apply migration 015_remove_simulation_and_seed_minimal.sql");
    }
    throw new Error(existingRes.error.message);
  }

  const existing = existingRes.data ?? [];
  if (existing.length >= target) return existing.map((x) => x.id);

  const need = target - existing.length;
  const rows = Array.from({ length: need }).map((_, idx) => {
    const city = pick(CITIES);
    return {
      title: `Demo event ${idx + 1}`,
      description: "Демо-мероприятие для проверки админки и метрик.",
      outcomes: ["нетворкинг", "новые знакомства", "обсуждение идей"],
      cover_url: null,
      event_date: new Date(Date.now() + rnd(1, 14) * 24 * 60 * 60 * 1000).toISOString(),
      price: chance(0.6) ? 0 : rnd(500, 2500),
      city,
      is_demo: true,
    };
  });

  const insert = await supabaseAdmin.from("events").insert(rows).select("id");
  if (insert.error) throw new Error(insert.error.message);

  return [...existing.map((x) => x.id), ...(insert.data ?? []).map((x) => x.id)].slice(0, target);
}

export async function seedMinimalData() {
  const users = await ensureDemoUsers(10);
  const events = await ensureDemoEvents(5);

  const postRows = Array.from({ length: 20 }).map((_, idx) => ({
    user_id: pick(users),
    type: chance(0.6) ? "daily_duo" : "reel",
    caption: `Demo post ${idx + 1}`,
    is_demo: true,
    created_at: new Date(Date.now() - rnd(0, 72) * 60 * 60 * 1000).toISOString(),
  }));
  const postInsert = await supabaseAdmin.from("posts").insert(postRows).select("id,user_id");
  if (postInsert.error) throw new Error(postInsert.error.message);

  const connectionRows = Array.from({ length: 10 }).map(() => {
    const from = pick(users);
    let to = pick(users);
    while (to === from) to = pick(users);
    return {
      from_user_id: from,
      to_user_id: to,
      status: chance(0.6) ? "accepted" : "pending",
      is_demo: true,
      created_at: new Date(Date.now() - rnd(0, 72) * 60 * 60 * 1000).toISOString(),
    };
  });
  const connectionInsert = await supabaseAdmin.from("connections").insert(connectionRows).select("id,from_user_id,to_user_id");
  if (connectionInsert.error) throw new Error(connectionInsert.error.message);

  const connectionPairs = (connectionInsert.data ?? []) as Array<{ id: string; from_user_id: string; to_user_id: string }>;
  const messageRows = Array.from({ length: 30 }).map((_, idx) => {
    const pair = pick(connectionPairs);
    const from = chance(0.5) ? pair.from_user_id : pair.to_user_id;
    const to = from === pair.from_user_id ? pair.to_user_id : pair.from_user_id;

    return {
      event_id: chance(0.35) ? pick(events) : null,
      from_user_id: from,
      to_user_id: to,
      content: `Demo message ${idx + 1}`,
      is_demo: true,
      created_at: new Date(Date.now() - rnd(0, 72) * 60 * 60 * 1000).toISOString(),
    };
  });
  const messagesInsert = await supabaseAdmin.from("messages").insert(messageRows);
  if (messagesInsert.error) throw new Error(messagesInsert.error.message);

  const analyticsRows = Array.from({ length: rnd(220, 420) }).map(() => {
    const eventName = pick([...ANALYTICS_EVENTS]);
    return {
      user_id: pick(users),
      event_name: eventName,
      path:
        eventName.includes("event")
          ? "/events"
          : eventName.includes("connect") || eventName.includes("message")
            ? "/contacts"
            : "/feed",
      properties: {
        is_demo: true,
        source: "seed_minimal",
        city: pick(CITIES),
        event_id: pick(events),
      },
      created_at: new Date(Date.now() - rnd(0, 10) * 24 * 60 * 60 * 1000 - rnd(0, 86_399) * 1000).toISOString(),
    };
  });

  const analyticsInsert = await supabaseAdmin.from("analytics_events").insert(analyticsRows);
  if (analyticsInsert.error) throw new Error(analyticsInsert.error.message);

  return {
    users: users.length,
    events: events.length,
    posts: postRows.length,
    connections: connectionRows.length,
    messages: messageRows.length,
    analyticsEvents: analyticsRows.length,
  };
}

async function findDemoIds() {
  const [usersRes, eventsRes] = await Promise.all([
    supabaseAdmin.from("users").select("id").eq("is_demo", true).limit(10000),
    supabaseAdmin.from("events").select("id").eq("is_demo", true).limit(10000),
  ]);

  if (usersRes.error) throw new Error(usersRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  return {
    userIds: (usersRes.data ?? []).map((x) => x.id),
    eventIds: (eventsRes.data ?? []).map((x) => x.id),
  };
}

export async function clearSeedDemoData() {
  const { userIds, eventIds } = await findDemoIds();

  if (!userIds.length && !eventIds.length) {
    return {
      deleted: {
        analytics_events: 0,
        messages: 0,
        connections: 0,
        posts: 0,
        event_members: 0,
        events: 0,
        users: 0,
      },
    };
  }

  const deleted = {
    analytics_events: 0,
    messages: 0,
    connections: 0,
    posts: 0,
    event_members: 0,
    events: 0,
    users: 0,
  };

  const analytics = await supabaseAdmin
    .from("analytics_events")
    .delete({ count: "exact" })
    .filter("properties->>is_demo", "eq", "true");
  if (!analytics.error) deleted.analytics_events = analytics.count ?? 0;

  if (eventIds.length) {
    const members = await supabaseAdmin.from("event_members").delete({ count: "exact" }).in("event_id", eventIds);
    if (!members.error) deleted.event_members = members.count ?? 0;
  }

  if (userIds.length) {
    const msg = await supabaseAdmin
      .from("messages")
      .delete({ count: "exact" })
      .or(`from_user_id.in.(${userIds.join(",")}),to_user_id.in.(${userIds.join(",")})`);
    if (!msg.error) deleted.messages = msg.count ?? 0;

    const con = await supabaseAdmin
      .from("connections")
      .delete({ count: "exact" })
      .or(`from_user_id.in.(${userIds.join(",")}),to_user_id.in.(${userIds.join(",")})`);
    if (!con.error) deleted.connections = con.count ?? 0;

    const posts = await supabaseAdmin.from("posts").delete({ count: "exact" }).in("user_id", userIds);
    if (!posts.error) deleted.posts = posts.count ?? 0;
  }

  if (eventIds.length) {
    const eventsDelete = await supabaseAdmin.from("events").delete({ count: "exact" }).in("id", eventIds);
    if (!eventsDelete.error) deleted.events = eventsDelete.count ?? 0;
  }

  if (userIds.length) {
    const usersDelete = await supabaseAdmin.from("users").delete({ count: "exact" }).in("id", userIds);
    if (!usersDelete.error) deleted.users = usersDelete.count ?? 0;
  }

  return { deleted };
}
