import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";

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

function isMissingTableError(message?: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("could not find the table") ||
    m.includes("schema cache")
  );
}

async function assertTable(table: string, probe = "id") {
  const check = await supabaseAdmin.from(table).select(probe, { count: "exact", head: true }).limit(1);
  if (!check.error) return true;
  if (isMissingTableError(check.error.message)) return false;
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

async function readColumns() {
  const schema = await getSchemaSnapshot([
    "users",
    "events",
    "analytics_events",
    "traffic_runs",
    "posts",
    "connections",
    "messages",
    "reports",
    "event_members",
  ]);

  return {
    users: asSet(schema, "users"),
    events: asSet(schema, "events"),
    analytics: asSet(schema, "analytics_events"),
    runs: asSet(schema, "traffic_runs"),
    posts: asSet(schema, "posts"),
    connections: asSet(schema, "connections"),
    messages: asSet(schema, "messages"),
    reports: asSet(schema, "reports"),
    eventMembers: asSet(schema, "event_members"),
  };
}

async function selectTrafficUsers(limit: number, userCols: Set<string>) {
  const selectCols = ["id", "name", "phone", "city", "country", "is_demo", "demo_group"].filter((c) => userCols.has(c));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  let query = supabaseAdmin
    .from("users")
    .select(selectCols.join(","))
    .limit(limit);

  if (userCols.has("created_at")) query = query.order("created_at", { ascending: true });
  else if (userCols.has("id")) query = query.order("id", { ascending: true });

  if (userCols.has("is_demo")) query = query.eq("is_demo", true);
  if (userCols.has("demo_group")) query = query.eq("demo_group", "traffic");
  else if (userCols.has("name")) query = query.ilike("name", "Traffic Demo%");

  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

async function ensureTrafficUsers(target: number, userCols: Set<string>) {
  const existing = await selectTrafficUsers(target, userCols);
  if (existing.length >= target) return existing.slice(0, target);

  const need = target - existing.length;
  const rows: Array<Record<string, unknown>> = [];

  for (let idx = 0; idx < need; idx += 1) {
    const city = pick(CITIES);
    const n = existing.length + idx + 1;

    const candidate = pickExistingColumns(
      {
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
      },
      userCols,
    );

    if (userCols.has("name") && !candidate.name) candidate.name = `Traffic Demo ${String(n).padStart(2, "0")}`;
    if (userCols.has("phone") && !candidate.phone) candidate.phone = randomPhone();
    if (userCols.has("id") && !candidate.id) candidate.id = randomUUID();

    rows.push(candidate);
  }

  if (rows.length > 0) {
    const ins = await supabaseAdmin.from("users").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }

  return selectTrafficUsers(target, userCols);
}

async function ensureTrafficEvents(target: number, eventCols: Set<string>) {
  const selectCols = ["id", "title", "city", "is_demo", "demo_group"].filter((c) => eventCols.has(c));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  let existingQuery = supabaseAdmin
    .from("events")
    .select(selectCols.join(","))
    .limit(target);

  if (eventCols.has("created_at")) existingQuery = existingQuery.order("created_at", { ascending: false });
  else if (eventCols.has("id")) existingQuery = existingQuery.order("id", { ascending: false });

  if (eventCols.has("is_demo")) existingQuery = existingQuery.eq("is_demo", true);
  if (eventCols.has("demo_group")) existingQuery = existingQuery.eq("demo_group", "traffic");
  else if (eventCols.has("title")) existingQuery = existingQuery.ilike("title", "Traffic Event%");

  const existingRes = await existingQuery;
  if (existingRes.error) throw new Error(existingRes.error.message);

  const existing = existingRes.data ?? [];
  if (existing.length >= target) return existing;

  const need = target - existing.length;
  const rows: Array<Record<string, unknown>> = [];

  for (let idx = 0; idx < need; idx += 1) {
    const city = pick(CITIES);
    const row = pickExistingColumns(
      {
        title: `Traffic Event ${idx + 1}`,
        description: "Демо событие для оживления аналитики",
        outcomes: ["нетворкинг", "воронка", "retention"],
        event_date: new Date(Date.now() + rnd(1, 12) * 24 * 60 * 60 * 1000).toISOString(),
        city,
        price: chance(0.6) ? 0 : rnd(500, 2000),
        is_demo: true,
        demo_group: "traffic",
      },
      eventCols,
    );

    if (eventCols.has("title") && !row.title) row.title = `Traffic Event ${idx + 1}`;
    rows.push(row);
  }

  if (rows.length > 0) {
    const ins = await supabaseAdmin.from("events").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }

  return ensureTrafficEvents(target, eventCols);
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

  const cols = await readColumns();

  const usersCount = Math.max(5, Math.min(200, input.usersCount));
  const intervalSec = Math.max(3, Math.min(30, input.intervalSec));

  await ensureTrafficUsers(usersCount, cols.users);
  await ensureTrafficEvents(10, cols.events);

  await supabaseAdmin
    .from("traffic_runs")
    .update(pickExistingColumns({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, cols.runs))
    .eq("status", "running");

  const runRow = pickExistingColumns(
    {
      status: "running",
      users_count: usersCount,
      interval_sec: intervalSec,
      intensity: input.intensity,
      chaos: input.chaos,
      created_by: input.createdBy,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    cols.runs,
  );

  const ins = await supabaseAdmin.from("traffic_runs").insert(runRow).select("*").single();
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

  if (!targetId) return { run_id: null, status: "stopped" as const };

  const cols = await readColumns();
  const upd = await supabaseAdmin
    .from("traffic_runs")
    .update(pickExistingColumns({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, cols.runs))
    .eq("id", targetId)
    .select("id,status")
    .maybeSingle();

  if (upd.error) throw new Error(upd.error.message);
  return { run_id: targetId, status: "stopped" as const };
}

function applyTrafficScope(query: any, analyticsCols: Set<string>, runStartedAt: string, demoUserIds: string[]) {
  let scoped = query;

  if (analyticsCols.has("properties")) {
    scoped = scoped.filter("properties->>demo_group", "eq", "traffic");
  } else if (analyticsCols.has("user_id") && demoUserIds.length) {
    scoped = scoped.in("user_id", demoUserIds);
  }

  if (analyticsCols.has("created_at")) {
    scoped = scoped.gte("created_at", runStartedAt);
  }

  return scoped;
}

export async function getTrafficStatus(runId?: string | null) {
  let query = supabaseAdmin.from("traffic_runs").select("*").order("started_at", { ascending: false }).limit(1);
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

  const cols = await readColumns();
  const users = await selectTrafficUsers(Math.max(10, run.users_count), cols.users);
  const userIds = users.map((u: any) => String(u.id)).filter(Boolean);

  const [countAll, count2m, lastEv, sample] = await Promise.all([
    applyTrafficScope(
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }),
      cols.analytics,
      run.started_at,
      userIds,
    ),
    applyTrafficScope(
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()),
      cols.analytics,
      run.started_at,
      userIds,
    ),
    applyTrafficScope(
      supabaseAdmin.from("analytics_events").select("created_at").order("created_at", { ascending: false }).limit(1),
      cols.analytics,
      run.started_at,
      userIds,
    ),
    applyTrafficScope(
      supabaseAdmin.from("analytics_events").select("event_name,created_at,user_id").order("created_at", { ascending: false }).limit(12),
      cols.analytics,
      run.started_at,
      userIds,
    ),
  ]);

  const [totalRes, twoRes, lastRes, sampleRes] = await Promise.all([countAll, count2m, lastEv, sample]);

  const totalEvents = totalRes.count ?? 0;
  const events2m = twoRes.count ?? 0;
  const lastEventAt = (lastRes.data?.[0] as any)?.created_at ?? null;

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
    sample_events: sampleRes.data ?? [],
  };
}

async function tryInsertPost(userId: string, eventName: TrafficEventName, createdAt: string, postCols: Set<string>) {
  if (eventName !== "feed.post_published_daily_duo" && eventName !== "feed.post_published_video") return;

  const row = pickExistingColumns(
    {
      user_id: userId,
      type: eventName === "feed.post_published_daily_duo" ? "daily_duo" : "reel",
      caption: eventName === "feed.post_published_daily_duo" ? "Traffic demo duo" : "Traffic demo video",
      is_demo: true,
      demo_group: "traffic",
      created_at: createdAt,
    },
    postCols,
  );

  if (!Object.keys(row).length) return;
  await supabaseAdmin.from("posts").insert(row);
}

async function tryInsertEventJoin(userId: string, eventId: string, createdAt: string, eventMembersCols: Set<string>) {
  const row = pickExistingColumns(
    {
      event_id: eventId,
      user_id: userId,
      joined_at: createdAt,
      created_at: createdAt,
    },
    eventMembersCols,
  );

  if (!Object.keys(row).length) return;
  await supabaseAdmin.from("event_members").insert(row).select("event_id").maybeSingle();
}

async function tryInsertConnectionAndMessage(
  fromUser: string,
  toUser: string,
  createdAt: string,
  eventName: TrafficEventName,
  cols: { connections: Set<string>; messages: Set<string> },
  chaos = false,
) {
  if (eventName !== "chat.connect_sent" && eventName !== "chat.connect_replied" && eventName !== "chat.message_sent") return;

  const status = eventName === "chat.connect_replied" || eventName === "chat.message_sent" ? "accepted" : "pending";

  const connectionRow = pickExistingColumns(
    {
      from_user_id: fromUser,
      to_user_id: toUser,
      status,
      is_demo: true,
      demo_group: "traffic",
      created_at: createdAt,
    },
    cols.connections,
  );

  if (Object.keys(connectionRow).length) {
    await supabaseAdmin.from("connections").insert(connectionRow);
  }

  if (eventName === "chat.message_sent" || eventName === "chat.connect_replied") {
    const text = chaos ? "hello-traffic-spam" : pick(["Привет!", "Давай познакомимся", "Как прошел ивент?"]);
    const messageRow = pickExistingColumns(
      {
        from_user_id: fromUser,
        to_user_id: toUser,
        content: text,
        is_demo: true,
        demo_group: "traffic",
        created_at: createdAt,
      },
      cols.messages,
    );

    if (Object.keys(messageRow).length) {
      await supabaseAdmin.from("messages").insert(messageRow);
    }
  }
}

async function tryInsertReport(reporter: string, target: string, createdAt: string, reportsCols: Set<string>) {
  const row = pickExistingColumns(
    {
      reporter_user_id: reporter,
      target_user_id: target,
      content_type: "profile",
      content_id: null,
      reason: "spam",
      details: "traffic generator demo report",
      status: "open",
      created_at: createdAt,
    },
    reportsCols,
  );

  if (!Object.keys(row).length) return;
  await supabaseAdmin.from("reports").insert(row);
}

export async function tickTrafficRun(runId?: string | null): Promise<TrafficTickResult> {
  const status = await getTrafficStatus(runId);
  const run = status.run;
  if (!run || run.status !== "running") throw new Error("Traffic is not running");

  const cols = await readColumns();
  const users = await ensureTrafficUsers(run.users_count, cols.users);
  const events = await ensureTrafficEvents(10, cols.events);
  if (!users.length || !events.length) {
    throw new Error("No demo users/events available for traffic generation");
  }

  const batch = intensityBatch(run.intensity);
  const now = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  const sample: Array<{ event_name: string; user_id: string; created_at: string }> = [];

  const spamUsers = (run.chaos ? users.slice(0, 2).map((u: any) => String(u.id)) : []) as string[];
  const reportTarget = run.chaos && users.length > 3 ? String(users[3]?.id) : null;

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
      properties.message_hash = run.chaos && spamUsers.includes(String(user.id)) ? "traffic-spam-hash" : `msg-${rnd(1, 12)}`;
    }

    const analyticsRow = pickExistingColumns(
      {
        event_name: event,
        user_id: String(user.id),
        path: event.startsWith("events") ? "/events" : event.startsWith("feed") ? "/feed" : event.startsWith("chat") ? "/contacts" : "/register",
        properties,
        created_at: createdAt,
      },
      cols.analytics,
    );

    rows.push(analyticsRow);
    if (sample.length < 12) sample.push({ event_name: event, user_id: String(user.id), created_at: createdAt });

    void tryInsertPost(String(user.id), event, createdAt, cols.posts);
    if (event === "events.joined") void tryInsertEventJoin(String(user.id), String(eventObj.id), createdAt, cols.eventMembers);

    let peer = pick(users) as any;
    while (String(peer.id) === String(user.id)) peer = pick(users) as any;
    void tryInsertConnectionAndMessage(String(user.id), String(peer.id), createdAt, event, { connections: cols.connections, messages: cols.messages }, false);

    if (event === "safety.report_created" && reportTarget && reportTarget !== String(user.id)) {
      void tryInsertReport(String(user.id), reportTarget, createdAt, cols.reports);
    }
  }

  if (run.chaos && spamUsers.length) {
    for (let j = 0; j < 22; j += 1) {
      const spammer = String(pick(spamUsers));
      let peer = pick(users) as any;
      while (String(peer.id) === spammer) peer = pick(users) as any;
      const createdAt = new Date(now - rnd(0, 30_000)).toISOString();

      rows.push(
        pickExistingColumns(
          {
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
          },
          cols.analytics,
        ),
      );

      void tryInsertConnectionAndMessage(spammer, String(peer.id), createdAt, "chat.connect_sent", { connections: cols.connections, messages: cols.messages }, true);
    }

    if (reportTarget) {
      for (let k = 0; k < 8; k += 1) {
        const reporter = pick(users) as any;
        if (String(reporter.id) === reportTarget) continue;
        const createdAt = new Date(now - rnd(0, 20_000)).toISOString();

        rows.push(
          pickExistingColumns(
            {
              event_name: "safety.report_created",
              user_id: String(reporter.id),
              path: "/reports",
              properties: {
                demo_group: "traffic",
                is_demo: true,
                run_id: run.id,
                chaos: true,
                target_user_id: reportTarget,
              },
              created_at: createdAt,
            },
            cols.analytics,
          ),
        );

        void tryInsertReport(String(reporter.id), reportTarget, createdAt, cols.reports);
      }
    }
  }

  const rowsToInsert = rows.filter((r) => Object.keys(r).length > 0);
  if (rowsToInsert.length > 0) {
    const ins = await supabaseAdmin.from("analytics_events").insert(rowsToInsert);
    if (ins.error) throw new Error(ins.error.message);
  }

  await supabaseAdmin.from("traffic_runs").update(pickExistingColumns({ updated_at: new Date().toISOString() }, cols.runs)).eq("id", run.id).eq("status", "running");

  const lastAt = rowsToInsert.reduce((acc, row) => {
    const ts = String(row.created_at ?? "");
    return ts > acc ? ts : acc;
  }, new Date().toISOString());

  return {
    events_written: rowsToInsert.length,
    last_event_at: lastAt,
    sample_events: sample,
  };
}
