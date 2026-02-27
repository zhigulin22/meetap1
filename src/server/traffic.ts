import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/supabase/admin";

type Intensity = "low" | "normal" | "high";

type TrafficEventName =
  | "auth.register_started"
  | "auth.registration_completed"
  | "events.viewed"
  | "events.joined"
  | "feed.post_published_daily_duo"
  | "feed.post_published_video"
  | "chat.connect_sent"
  | "chat.connect_replied"
  | "chat.message_sent"
  | "safety.report_created";

type TrafficTickResult = {
  events_written: number;
  last_event_at: string;
  sample_events: Array<{ event_name: string; user_id: string; created_at: string }>;
};

type TrafficRunRow = {
  id: string;
  status: string;
  users_count: number;
  interval_sec: number;
  intensity: Intensity;
  chaos: boolean;
  started_at: string;
  updated_at: string;
  stopped_at: string | null;
};

const CITIES = ["Moscow", "Dubai", "Tbilisi", "Berlin", "Warsaw", "Belgrade", "London", "Lisbon"];
const NAMES = ["Alex", "Mila", "Ivan", "Nina", "Artem", "Sofia", "Tim", "Daria", "Leo", "Mark", "Sam", "Eva"];
const INTERESTS = ["design", "startup", "music", "sport", "ai", "marketing", "product", "travel", "coffee", "books"];

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

function intensityBatch(intensity: Intensity) {
  if (intensity === "low") return rnd(16, 28);
  if (intensity === "high") return rnd(70, 120);
  return rnd(36, 64);
}

function weightedEvent(intensity: Intensity): TrafficEventName {
  const pool: Array<{ e: TrafficEventName; w: number }> =
    intensity === "low"
      ? [
          { e: "events.viewed", w: 30 },
          { e: "events.joined", w: 14 },
          { e: "chat.connect_sent", w: 14 },
          { e: "chat.connect_replied", w: 8 },
          { e: "chat.message_sent", w: 10 },
          { e: "feed.post_published_daily_duo", w: 8 },
          { e: "feed.post_published_video", w: 5 },
          { e: "auth.register_started", w: 5 },
          { e: "auth.registration_completed", w: 4 },
          { e: "safety.report_created", w: 2 },
        ]
      : intensity === "high"
        ? [
            { e: "events.viewed", w: 24 },
            { e: "events.joined", w: 16 },
            { e: "chat.connect_sent", w: 20 },
            { e: "chat.connect_replied", w: 10 },
            { e: "chat.message_sent", w: 14 },
            { e: "feed.post_published_daily_duo", w: 7 },
            { e: "feed.post_published_video", w: 4 },
            { e: "auth.register_started", w: 3 },
            { e: "auth.registration_completed", w: 1 },
            { e: "safety.report_created", w: 1 },
          ]
        : [
            { e: "events.viewed", w: 28 },
            { e: "events.joined", w: 15 },
            { e: "chat.connect_sent", w: 16 },
            { e: "chat.connect_replied", w: 9 },
            { e: "chat.message_sent", w: 12 },
            { e: "feed.post_published_daily_duo", w: 8 },
            { e: "feed.post_published_video", w: 4 },
            { e: "auth.register_started", w: 4 },
            { e: "auth.registration_completed", w: 2 },
            { e: "safety.report_created", w: 2 },
          ];

  const total = pool.reduce((acc, item) => acc + item.w, 0);
  let ticket = rnd(1, total);
  for (const item of pool) {
    ticket -= item.w;
    if (ticket <= 0) return item.e;
  }
  return "events.viewed";
}

function missingColumn(message: string | undefined, column: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

function missingTable(message: string | undefined, table: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes(table.toLowerCase()) && (m.includes("does not exist") || m.includes("relation") || m.includes("could not find"));
}

async function assertTable(table: string, probe = "id") {
  const check = await supabaseAdmin.from(table).select(probe, { count: "exact", head: true }).limit(1);
  if (!check.error) return true;
  if (missingTable(check.error.message, table)) return false;
  throw new Error(check.error.message);
}

export async function missingTrafficTables() {
  const map = [
    ["traffic_runs", "id"],
    ["analytics_events", "id"],
    ["users", "id"],
    ["events", "id"],
  ] as const;

  const checks = await Promise.all(map.map(([table, probe]) => assertTable(table, probe)));
  return map.filter((_, idx) => !checks[idx]).map((x) => x[0]);
}

async function selectTrafficUsers(limit: number) {
  const q = await supabaseAdmin
    .from("users")
    .select("id,name,city,country")
    .eq("is_demo", true)
    .eq("demo_group", "traffic")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!q.error) return q.data ?? [];
  if (!missingColumn(q.error.message, "demo_group")) throw new Error(q.error.message);

  const fallback = await supabaseAdmin
    .from("users")
    .select("id,name,city,country")
    .eq("is_demo", true)
    .ilike("name", "Traffic Demo%")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fallback.error) throw new Error(fallback.error.message);
  return fallback.data ?? [];
}

async function ensureTrafficUsers(target: number) {
  const existing = await selectTrafficUsers(target);
  if (existing.length >= target) return existing.slice(0, target);

  const need = target - existing.length;
  const rows = Array.from({ length: need }).map((_, idx) => {
    const city = pick(CITIES);
    const n = existing.length + idx + 1;
    return {
      id: randomUUID(),
      phone: randomPhone(),
      name: `Traffic Demo ${String(n).padStart(2, "0")}`,
      telegram_verified: chance(0.7),
      role: "user",
      is_demo: true,
      demo_group: "traffic",
      city,
      country: city,
      interests: randomInterests(rnd(3, 5)),
      hobbies: ["networking", "events", "demo"],
      facts: ["Демо пользователь", "Сгенерирован сервером", "Для QA метрик"],
      profile_completed: chance(0.65),
      level: rnd(1, 6),
      xp: rnd(0, 120),
    };
  });

  let ins = await supabaseAdmin.from("users").insert(rows);
  if (ins.error && missingColumn(ins.error.message, "demo_group")) {
    const fallbackRows = rows.map(({ demo_group: _skip, ...rest }) => rest);
    ins = await supabaseAdmin.from("users").insert(fallbackRows);
  }
  if (ins.error) throw new Error(ins.error.message);

  return selectTrafficUsers(target);
}

async function ensureTrafficEvents(target = 10) {
  const existingRes = await supabaseAdmin
    .from("events")
    .select("id,title,city")
    .eq("is_demo", true)
    .eq("demo_group", "traffic")
    .order("created_at", { ascending: false })
    .limit(target);

  let existing = existingRes.data ?? [];
  if (existingRes.error) {
    if (!missingColumn(existingRes.error.message, "demo_group")) throw new Error(existingRes.error.message);
    const fallback = await supabaseAdmin
      .from("events")
      .select("id,title,city")
      .eq("is_demo", true)
      .ilike("title", "Traffic Event%")
      .order("created_at", { ascending: false })
      .limit(target);
    if (fallback.error) throw new Error(fallback.error.message);
    existing = fallback.data ?? [];
  }

  if (existing.length >= target) return existing;

  const need = target - existing.length;
  const rows = Array.from({ length: need }).map((_, idx) => {
    const city = pick(CITIES);
    return {
      title: `Traffic Event ${idx + 1}`,
      description: "Демо событие для оживления аналитики",
      outcomes: ["нетворкинг", "воронка", "retention"],
      event_date: new Date(Date.now() + rnd(1, 12) * 24 * 60 * 60 * 1000).toISOString(),
      city,
      price: chance(0.6) ? 0 : rnd(500, 2000),
      is_demo: true,
      demo_group: "traffic",
    };
  });

  let ins = await supabaseAdmin.from("events").insert(rows);
  if (ins.error && missingColumn(ins.error.message, "demo_group")) {
    const fallbackRows = rows.map(({ demo_group: _skip, ...rest }) => rest);
    ins = await supabaseAdmin.from("events").insert(fallbackRows);
  }
  if (ins.error) throw new Error(ins.error.message);

  return ensureTrafficEvents(target);
}

export async function startTrafficRun(input: {
  createdBy: string;
  usersCount: number;
  intervalSec: number;
  intensity: Intensity;
  chaos: boolean;
}) {
  const missing = await missingTrafficTables();
  if (missing.length) {
    throw new Error(`Cannot start traffic: missing tables ${missing.join(", ")}`);
  }

  const usersCount = Math.max(5, Math.min(200, input.usersCount));
  const intervalSec = Math.max(3, Math.min(30, input.intervalSec));

  await ensureTrafficUsers(usersCount);
  await ensureTrafficEvents(10);

  await supabaseAdmin
    .from("traffic_runs")
    .update({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("status", "running");

  const ins = await supabaseAdmin
    .from("traffic_runs")
    .insert({
      status: "running",
      users_count: usersCount,
      interval_sec: intervalSec,
      intensity: input.intensity,
      chaos: input.chaos,
      created_by: input.createdBy,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (ins.error) throw new Error(ins.error.message);

  return ins.data as TrafficRunRow;
}

export async function stopTrafficRun(runId?: string | null) {
  let targetId = runId ?? null;

  if (!targetId) {
    const latest = await supabaseAdmin
      .from("traffic_runs")
      .select("id")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetId = latest.data?.id ?? null;
  }

  if (!targetId) {
    return { run_id: null, status: "stopped" as const };
  }

  const upd = await supabaseAdmin
    .from("traffic_runs")
    .update({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", targetId)
    .select("id,status")
    .maybeSingle();

  if (upd.error) throw new Error(upd.error.message);

  return { run_id: targetId, status: "stopped" as const };
}

export async function getTrafficStatus(runId?: string | null) {
  let query = supabaseAdmin
    .from("traffic_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);

  if (runId) query = supabaseAdmin.from("traffic_runs").select("*").eq("id", runId).limit(1);

  const runRes = await query.maybeSingle();
  if (runRes.error) throw new Error(runRes.error.message);

  const run = runRes.data as TrafficRunRow | null;
  if (!run) {
    return {
      run: null,
      runtime_status: "STOPPED",
      total_events: 0,
      events_last_2m: 0,
      last_event_at: null,
      sample_events: [] as Array<{ event_name: string; created_at: string; user_id: string | null }>,
    };
  }

  const [countAll, count2m, lastEv, sample] = await Promise.all([
    supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .filter("properties->>demo_group", "eq", "traffic")
      .gte("created_at", run.started_at),
    supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .filter("properties->>demo_group", "eq", "traffic")
      .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()),
    supabaseAdmin
      .from("analytics_events")
      .select("created_at")
      .filter("properties->>demo_group", "eq", "traffic")
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("analytics_events")
      .select("event_name,created_at,user_id")
      .filter("properties->>demo_group", "eq", "traffic")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const totalEvents = countAll.count ?? 0;
  const events2m = count2m.count ?? 0;
  const lastEventAt = lastEv.data?.[0]?.created_at ?? null;

  let runtimeStatus = "STOPPED";
  if (run.status === "running") {
    runtimeStatus = "STARTING";
    if (events2m > 0) runtimeStatus = "RUNNING";
    if (totalEvents > 0 && events2m === 0) runtimeStatus = "DEGRADED";
  }

  return {
    run,
    runtime_status: runtimeStatus,
    total_events: totalEvents,
    events_last_2m: events2m,
    last_event_at: lastEventAt,
    sample_events: sample.data ?? [],
  };
}

async function tryInsertPost(userId: string, eventName: TrafficEventName, createdAt: string) {
  if (eventName !== "feed.post_published_daily_duo" && eventName !== "feed.post_published_video") return;

  const row = {
    user_id: userId,
    type: eventName === "feed.post_published_daily_duo" ? "daily_duo" : "reel",
    caption: eventName === "feed.post_published_daily_duo" ? "Traffic demo duo" : "Traffic demo video",
    is_demo: true,
    demo_group: "traffic",
    created_at: createdAt,
  };

  let ins = await supabaseAdmin.from("posts").insert(row);
  if (ins.error && missingColumn(ins.error.message, "demo_group")) {
    const { demo_group: _skip, ...fallback } = row;
    ins = await supabaseAdmin.from("posts").insert(fallback);
  }
}

async function tryInsertEventJoin(userId: string, eventId: string, createdAt: string) {
  await supabaseAdmin.from("event_members").insert({
    event_id: eventId,
    user_id: userId,
    joined_at: createdAt,
  }).select("event_id").maybeSingle();
}

async function tryInsertConnectionAndMessage(fromUser: string, toUser: string, createdAt: string, eventName: TrafficEventName, chaos = false) {
  if (eventName !== "chat.connect_sent" && eventName !== "chat.connect_replied" && eventName !== "chat.message_sent") return;

  const status = eventName === "chat.connect_replied" || eventName === "chat.message_sent" ? "accepted" : "pending";
  const conRow = {
    from_user_id: fromUser,
    to_user_id: toUser,
    status,
    is_demo: true,
    demo_group: "traffic",
    created_at: createdAt,
  };

  let cIns = await supabaseAdmin.from("connections").insert(conRow);
  if (cIns.error && missingColumn(cIns.error.message, "demo_group")) {
    const { demo_group: _skip, ...fallback } = conRow;
    cIns = await supabaseAdmin.from("connections").insert(fallback);
  }

  if (eventName === "chat.message_sent" || eventName === "chat.connect_replied") {
    const text = chaos ? "hello-traffic-spam" : pick(["Привет!", "Давай познакомимся", "Как прошел ивент?"]);
    const mRow = {
      from_user_id: fromUser,
      to_user_id: toUser,
      content: text,
      is_demo: true,
      demo_group: "traffic",
      created_at: createdAt,
    };

    let mIns = await supabaseAdmin.from("messages").insert(mRow);
    if (mIns.error && missingColumn(mIns.error.message, "demo_group")) {
      const { demo_group: _skip, ...fallback } = mRow;
      mIns = await supabaseAdmin.from("messages").insert(fallback);
    }
  }
}

async function tryInsertReport(reporter: string, target: string, createdAt: string) {
  await supabaseAdmin.from("reports").insert({
    reporter_user_id: reporter,
    target_user_id: target,
    content_type: "profile",
    content_id: null,
    reason: "spam",
    details: "traffic generator demo report",
    status: "open",
    created_at: createdAt,
  });
}

export async function tickTrafficRun(runId?: string | null): Promise<TrafficTickResult> {
  const status = await getTrafficStatus(runId);
  const run = status.run;
  if (!run || run.status !== "running") {
    throw new Error("Traffic is not running");
  }

  const users = await ensureTrafficUsers(run.users_count);
  const events = await ensureTrafficEvents(10);
  if (!users.length || !events.length) {
    throw new Error("No demo users/events available for traffic generation");
  }

  const batch = intensityBatch(run.intensity);
  const now = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  const sample: Array<{ event_name: string; user_id: string; created_at: string }> = [];

  const spamUsers = (run.chaos ? users.slice(0, 2).map((u: any) => String(u.id)) : []) as string[];
  const reportTarget = run.chaos && users.length > 3 ? users[3]?.id : null;

  for (let i = 0; i < batch; i += 1) {
    const user = pick(users) as any;
    const event = weightedEvent(run.intensity);
    const createdAt = new Date(now - rnd(0, 45_000)).toISOString();
    const eventObj = pick(events) as any;

    const properties: Record<string, unknown> = {
      demo_group: "traffic",
      is_demo: true,
      run_id: run.id,
      city: user.city ?? user.country ?? pick(CITIES),
      event_id: eventObj.id,
      chaos: run.chaos,
    };

    if (event === "chat.connect_sent" || event === "chat.message_sent") {
      properties.message_hash = run.chaos && spamUsers.includes(user.id) ? "traffic-spam-hash" : `msg-${rnd(1, 12)}`;
    }

    rows.push({
      event_name: event,
      user_id: user.id,
      path:
        event.startsWith("events")
          ? "/events"
          : event.startsWith("feed")
            ? "/feed"
            : event.startsWith("chat")
              ? "/contacts"
              : "/register",
      properties,
      created_at: createdAt,
    });

    if (sample.length < 12) sample.push({ event_name: event, user_id: user.id, created_at: createdAt });

    void tryInsertPost(user.id, event, createdAt);
    if (event === "events.joined") void tryInsertEventJoin(user.id, eventObj.id, createdAt);

    let peer = pick(users) as any;
    while (peer.id === user.id) peer = pick(users) as any;
    void tryInsertConnectionAndMessage(user.id, peer.id, createdAt, event, false);

    if (event === "safety.report_created" && reportTarget && reportTarget !== user.id) {
      void tryInsertReport(user.id, reportTarget, createdAt);
    }
  }

  if (run.chaos && spamUsers.length) {
    for (let j = 0; j < 22; j += 1) {
      const spammer = String(pick(spamUsers));
      let peer = pick(users) as any;
      while (peer.id === spammer) peer = pick(users) as any;
      const createdAt = new Date(now - rnd(0, 30_000)).toISOString();

      rows.push({
        event_name: "chat.connect_sent",
        user_id: spammer,
        path: "/contacts",
        properties: {
          demo_group: "traffic",
          is_demo: true,
          run_id: run.id,
          chaos: true,
          message_hash: "traffic-spam-hash",
          spam_burst: true,
        },
        created_at: createdAt,
      });

      void tryInsertConnectionAndMessage(spammer, peer.id, createdAt, "chat.connect_sent", true);
    }

    if (reportTarget) {
      for (let k = 0; k < 8; k += 1) {
        const reporter = pick(users) as any;
        if (reporter.id === reportTarget) continue;
        const createdAt = new Date(now - rnd(0, 20_000)).toISOString();

        rows.push({
          event_name: "safety.report_created",
          user_id: reporter.id,
          path: "/reports",
          properties: {
            demo_group: "traffic",
            is_demo: true,
            run_id: run.id,
            chaos: true,
            target_user_id: reportTarget,
          },
          created_at: createdAt,
        });

        void tryInsertReport(reporter.id, reportTarget, createdAt);
      }
    }
  }

  const ins = await supabaseAdmin.from("analytics_events").insert(rows);
  if (ins.error) throw new Error(ins.error.message);

  await supabaseAdmin
    .from("traffic_runs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", "running");

  const lastAt = rows.reduce((acc, row) => {
    const ts = String(row.created_at ?? "");
    return ts > acc ? ts : acc;
  }, new Date().toISOString());

  return {
    events_written: rows.length,
    last_event_at: lastAt,
    sample_events: sample,
  };
}
