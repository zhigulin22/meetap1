import { randomUUID } from "crypto";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
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
  | "comment.created"
  | "profile.completed"
  | "safety.report_created";

export type TrafficTickResult = {
  run_id: string;
  events_written: number;
  last_event_at: string;
  sample_events: Array<{ event_name: string; user_id: string; created_at: string }>;
  duration_ms: number;
  batch_size_used: number;
  next_batch_size: number;
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
  batch_size_hint?: number | null;
  last_tick_duration_ms?: number | null;
};

export class TrafficEngineError extends Error {
  code: "SERVICE_ROLE_FAILED" | "TIMEOUT" | "DB" | "VALIDATION";
  hint: string;
  step: string;

  constructor(code: "SERVICE_ROLE_FAILED" | "TIMEOUT" | "DB" | "VALIDATION", message: string, hint: string, step: string) {
    super(message);
    this.name = "TrafficEngineError";
    this.code = code;
    this.hint = hint;
    this.step = step;
  }
}

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

function clampUsers(input: number) {
  return Math.max(5, Math.min(30, input));
}

function defaultBatchForIntensity(intensity: Intensity) {
  if (intensity === "low") return 70;
  if (intensity === "high") return 180;
  return 120;
}

function clampBatch(v: number) {
  return Math.max(40, Math.min(220, Math.floor(v)));
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

function isServiceRoleFailure(message?: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("service role") ||
    m.includes("jwt") ||
    m.includes("permission denied") ||
    m.includes("not allowed")
  );
}

function wrapSupabaseError(message: string, step: string): never {
  if (isServiceRoleFailure(message)) {
    throw new TrafficEngineError(
      "SERVICE_ROLE_FAILED",
      message,
      "Проверь SUPABASE_SERVICE_ROLE_KEY и права service role в Supabase/Vercel",
      step,
    );
  }
  throw new TrafficEngineError("DB", message, "Проверь таблицы и состояние Supabase", step);
}

function assertServiceRole() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new TrafficEngineError(
      "SERVICE_ROLE_FAILED",
      "SUPABASE_SERVICE_ROLE_KEY is missing",
      "Добавь SUPABASE_SERVICE_ROLE_KEY в environment и redeploy",
      "service_role_check",
    );
  }
}

async function assertTable(table: string, probe = "id") {
  const check = await supabaseAdmin.from(table).select(probe, { count: "exact", head: true }).limit(1);
  if (!check.error) return true;
  if (isMissingTableError(check.error.message)) return false;
  wrapSupabaseError(check.error.message, `assert_table:${table}`);
}

export async function missingTrafficTables() {
  assertServiceRole();
  const map = [
    ["traffic_runs", "id"],
    ["analytics_events", "id"],
    ["users", "id"],
  ] as const;

  const checks = await Promise.all(map.map(([table, probe]) => assertTable(table, probe)));
  return map.filter((_, idx) => !checks[idx]).map((x) => x[0]);
}

async function readColumns(
  tables: Array<"users" | "events" | "analytics_events" | "traffic_runs"> = [
    "users",
    "events",
    "analytics_events",
    "traffic_runs",
  ],
) {
  const schema = await getSchemaSnapshot(tables);
  return {
    users: asSet(schema, "users"),
    events: asSet(schema, "events"),
    analytics: asSet(schema, "analytics_events"),
    runs: asSet(schema, "traffic_runs"),
  };
}

async function selectTrafficUsers(limit: number, userCols: Set<string>) {
  const selectCols = ["id", "name", "phone", "city", "country", "is_demo", "demo_group"].filter((c) => userCols.has(c));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  let query = supabaseAdmin.from("users").select(selectCols.join(",")).limit(limit);

  if (userCols.has("created_at")) query = query.order("created_at", { ascending: true });
  else if (userCols.has("id")) query = query.order("id", { ascending: true });

  if (userCols.has("is_demo")) query = query.eq("is_demo", true);
  if (userCols.has("demo_group")) query = query.eq("demo_group", "traffic");
  else if (userCols.has("name")) query = query.ilike("name", "Traffic Demo%");

  const res = await query;
  if (res.error) wrapSupabaseError(res.error.message, "select_traffic_users");
  return res.data ?? [];
}

async function ensureTrafficUsers(targetInput: number, userCols: Set<string>) {
  const target = clampUsers(targetInput);
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
        username: `traffic_demo_${String(n).padStart(3, "0")}`,
        email: `traffic.demo.${String(n).padStart(3, "0")}@example.meetap`,
        telegram_verified: chance(0.7),
        role: "user",
        is_demo: true,
        demo_group: "traffic",
        city,
        country: city,
        interests: randomInterests(rnd(3, 5)),
        facts: ["Демо пользователь", "Сгенерирован сервером", "Для QA метрик"],
        profile_completed: chance(0.65),
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
    if (ins.error) wrapSupabaseError(ins.error.message, "creating_users");
  }

  return selectTrafficUsers(target, userCols);
}

function weightedEvent(intensity: Intensity): TrafficEventName {
  const pool: Array<{ e: TrafficEventName; w: number }> =
    intensity === "low"
      ? [
          { e: "events.viewed", w: 22 },
          { e: "events.joined", w: 14 },
          { e: "chat.connect_sent", w: 18 },
          { e: "chat.connect_replied", w: 10 },
          { e: "chat.message_sent", w: 12 },
          { e: "feed.post_published_daily_duo", w: 8 },
          { e: "feed.post_published_video", w: 6 },
          { e: "profile.completed", w: 4 },
          { e: "comment.created", w: 4 },
          { e: "safety.report_created", w: 2 },
        ]
      : intensity === "high"
      ? [
          { e: "events.viewed", w: 20 },
          { e: "events.joined", w: 15 },
          { e: "chat.connect_sent", w: 24 },
          { e: "chat.connect_replied", w: 12 },
          { e: "chat.message_sent", w: 14 },
          { e: "feed.post_published_daily_duo", w: 6 },
          { e: "feed.post_published_video", w: 4 },
          { e: "profile.completed", w: 2 },
          { e: "comment.created", w: 2 },
          { e: "safety.report_created", w: 1 },
        ]
      : [
          { e: "events.viewed", w: 22 },
          { e: "events.joined", w: 15 },
          { e: "chat.connect_sent", w: 20 },
          { e: "chat.connect_replied", w: 11 },
          { e: "chat.message_sent", w: 13 },
          { e: "feed.post_published_daily_duo", w: 7 },
          { e: "feed.post_published_video", w: 4 },
          { e: "profile.completed", w: 3 },
          { e: "comment.created", w: 3 },
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

async function selectRun(runId?: string | null) {
  let query = supabaseAdmin.from("traffic_runs").select("*").order("started_at", { ascending: false }).limit(1);
  if (runId) query = supabaseAdmin.from("traffic_runs").select("*").eq("id", runId).limit(1);

  const res = await query.maybeSingle();
  if (res.error) wrapSupabaseError(res.error.message, "load_run");
  return (res.data ?? null) as TrafficRunRow | null;
}

export async function startTrafficRun(input: {
  createdBy: string;
  usersCount: number;
  intervalSec: number;
  intensity: Intensity;
  chaos: boolean;
}) {
  assertServiceRole();

  const missing = await missingTrafficTables();
  if (missing.length) {
    throw new TrafficEngineError("DB", `Cannot start traffic: missing tables ${missing.join(", ")}`, "Примени SQL миграции для traffic tables", "checking_tables");
  }

  const cols = await readColumns(["users", "traffic_runs"]);

  const usersCount = clampUsers(input.usersCount);
  const intervalSec = Math.max(3, Math.min(30, input.intervalSec));

  await ensureTrafficUsers(usersCount, cols.users);

  if (cols.runs.has("status")) {
    const stopOld = await supabaseAdmin
      .from("traffic_runs")
      .update(pickExistingColumns({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, cols.runs))
      .eq("status", "running");
    if (stopOld.error) wrapSupabaseError(stopOld.error.message, "stop_previous_runs");
  }

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
      batch_size_hint: defaultBatchForIntensity(input.intensity),
      last_tick_duration_ms: 0,
    },
    cols.runs,
  );

  const ins = await supabaseAdmin.from("traffic_runs").insert(runRow).select("*").single();
  if (ins.error) wrapSupabaseError(ins.error.message, "creating_run");

  return ins.data as TrafficRunRow;
}

export async function stopTrafficRun(runId?: string | null) {
  assertServiceRole();
  let targetId = runId ?? null;

  if (!targetId) {
    const latest = await supabaseAdmin
      .from("traffic_runs")
      .select("id")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) wrapSupabaseError(latest.error.message, "select_running_for_stop");
    targetId = latest.data?.id ?? null;
  }

  if (!targetId) return { run_id: null, status: "stopped" as const };

  const cols = await readColumns(["traffic_runs"]);
  const upd = await supabaseAdmin
    .from("traffic_runs")
    .update(pickExistingColumns({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, cols.runs))
    .eq("id", targetId)
    .select("id,status")
    .maybeSingle();

  if (upd.error) wrapSupabaseError(upd.error.message, "stopping_run");
  return { run_id: targetId, status: "stopped" as const };
}

export async function getTrafficStatus(runId?: string | null) {
  assertServiceRole();
  const run = await selectRun(runId);

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

  const cols = await readColumns(["users", "analytics_events"]);
  const users = await selectTrafficUsers(Math.max(10, clampUsers(run.users_count)), cols.users);
  const userIds = users.map((u: any) => String(u.id)).filter(Boolean);

  const [countAllQ, count2mQ, lastQ, sampleQ] = [
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
  ];

  const [totalRes, twoRes, lastRes, sampleRes] = await Promise.all([countAllQ, count2mQ, lastQ, sampleQ]);

  if (totalRes.error) wrapSupabaseError(totalRes.error.message, "status_total_events");
  if (twoRes.error) wrapSupabaseError(twoRes.error.message, "status_events_2m");
  if (lastRes.error) wrapSupabaseError(lastRes.error.message, "status_last_event");
  if (sampleRes.error) wrapSupabaseError(sampleRes.error.message, "status_sample");

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

function getNextBatchHint(currentBatch: number, durationMs: number) {
  if (durationMs > 2000) return clampBatch(Math.floor(currentBatch * 0.6));
  if (durationMs < 900) return clampBatch(Math.ceil(currentBatch * 1.15));
  return clampBatch(currentBatch);
}

function inferBatchHint(run: TrafficRunRow) {
  const hinted = Number(run.batch_size_hint ?? 0);
  if (Number.isFinite(hinted) && hinted > 0) return clampBatch(hinted);
  return clampBatch(defaultBatchForIntensity(run.intensity));
}

export async function tickTrafficRun(runId?: string | null): Promise<TrafficTickResult> {
  assertServiceRole();
  const started = Date.now();

  const run = await selectRun(runId);
  if (!run || run.status !== "running") {
    throw new TrafficEngineError("VALIDATION", "Traffic is not running", "Сначала запусти traffic run через /start", "load_run");
  }

  const cols = await readColumns(["users", "analytics_events", "traffic_runs"]);
  const users = await ensureTrafficUsers(run.users_count, cols.users);
  if (!users.length) {
    throw new TrafficEngineError("DB", "No demo users available", "Не удалось создать demo users", "ensuring_users");
  }


  const batchSize = inferBatchHint(run);
  const now = Date.now();

  const rows: Array<Record<string, unknown>> = [];
  const sample: Array<{ event_name: string; user_id: string; created_at: string }> = [];

  const spamUsers = run.chaos ? users.slice(0, 2).map((u: any) => String(u.id)) : [];
  const reportTarget = run.chaos && users.length > 3 ? String((users[3] as any).id) : null;

  for (let i = 0; i < batchSize; i += 1) {
    const user = pick(users) as any;
    let eventName = weightedEvent(run.intensity);

    if (run.chaos && chance(0.12) && spamUsers.includes(String(user.id))) {
      eventName = "chat.connect_sent";
    }

    if (run.chaos && chance(0.05) && reportTarget && String(user.id) !== reportTarget) {
      eventName = "safety.report_created";
    }

    const createdAt = new Date(now - rnd(0, 45_000)).toISOString();
    const eventId = randomUUID();

    const properties: Record<string, unknown> = {
      demo_group: "traffic",
      is_demo: true,
      run_id: run.id,
      city: user.city ?? user.country ?? pick(CITIES),
      event_id: eventId,
      chaos: run.chaos,
    };

    if (eventName === "chat.connect_sent" || eventName === "chat.message_sent") {
      properties.message_hash = run.chaos && spamUsers.includes(String(user.id)) ? "traffic-spam-hash" : `msg-${rnd(1, 20)}`;
    }

    if (eventName === "safety.report_created" && reportTarget) {
      properties.target_user_id = reportTarget;
    }

    const analyticsRow = pickExistingColumns(
      {
        event_name: eventName,
        user_id: String(user.id),
        path: eventName.startsWith("events")
          ? "/events"
          : eventName.startsWith("feed")
          ? "/feed"
          : eventName.startsWith("chat")
          ? "/contacts"
          : "/register",
        properties,
        created_at: createdAt,
      },
      cols.analytics,
    );

    if (!Object.keys(analyticsRow).length) continue;
    rows.push(analyticsRow);
    if (sample.length < 12) sample.push({ event_name: eventName, user_id: String(user.id), created_at: createdAt });
  }

  if (!rows.length) {
    throw new TrafficEngineError("DB", "No rows generated for analytics_events", "Проверь схему analytics_events", "preparing_rows");
  }

  const ins = await supabaseAdmin.from("analytics_events").insert(rows);
  if (ins.error) wrapSupabaseError(ins.error.message, "inserting_events");

  const durationMs = Date.now() - started;
  const nextBatch = getNextBatchHint(batchSize, durationMs);

  const runUpdate = pickExistingColumns(
    {
      updated_at: new Date().toISOString(),
      batch_size_hint: nextBatch,
      last_tick_duration_ms: durationMs,
    },
    cols.runs,
  );

  if (Object.keys(runUpdate).length) {
    const upd = await supabaseAdmin.from("traffic_runs").update(runUpdate).eq("id", run.id).eq("status", "running");
    if (upd.error) wrapSupabaseError(upd.error.message, "updating_run_hint");
  }

  const lastAt = rows.reduce((acc, row) => {
    const ts = String((row as any).created_at ?? "");
    return ts > acc ? ts : acc;
  }, new Date().toISOString());

  return {
    run_id: run.id,
    events_written: rows.length,
    last_event_at: lastAt,
    sample_events: sample,
    duration_ms: durationMs,
    batch_size_used: batchSize,
    next_batch_size: nextBatch,
  };
}

export async function dryRunTraffic(input?: {
  runId?: string | null;
  usersCount?: number;
  intervalSec?: number;
  intensity?: Intensity;
  chaos?: boolean;
}) {
  assertServiceRole();
  const cols = await readColumns(["users", "traffic_runs"]);

  const activeRun = input?.runId ? await selectRun(input.runId) : await selectRun(null);
  const usersCount = clampUsers(input?.usersCount ?? activeRun?.users_count ?? 30);
  const intensity = (input?.intensity ?? activeRun?.intensity ?? "normal") as Intensity;
  const intervalSec = Math.max(3, Math.min(30, input?.intervalSec ?? activeRun?.interval_sec ?? 5));
  const chaos = Boolean(input?.chaos ?? activeRun?.chaos ?? false);

  const existingUsers = await selectTrafficUsers(usersCount, cols.users);
  const usersToCreate = Math.max(0, usersCount - existingUsers.length);
  const batch = activeRun ? inferBatchHint(activeRun) : clampBatch(defaultBatchForIntensity(intensity));

  return {
    ok: true,
    plan: {
      run_id: activeRun?.id ?? null,
      users_target: usersCount,
      users_existing: existingUsers.length,
      users_to_create: usersToCreate,
      interval_sec: intervalSec,
      intensity,
      chaos,
      batch_size: batch,
      estimated_events_per_tick: batch,
      estimated_events_per_minute: Math.floor((60 / intervalSec) * batch),
    },
  };
}
