import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/password";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";

type QaMode = "normal" | "chaos";
type QaRuntimeStatus = "STARTING" | "RUNNING" | "DEGRADED" | "STOPPED";

type RunnerAction = {
  bot_id: string;
  bot: string;
  action: string;
  at: string;
  event_name?: string | null;
};

type BotHeartbeatState = {
  bot_id: string;
  status?: string | null;
  last_action?: string | null;
  last_error?: string | null;
};

type QaLogInput = {
  bot_id: string;
  level: "info" | "warn" | "error";
  message: string;
};

const CITIES = ["Moscow", "Dubai", "Tbilisi", "Berlin", "Warsaw", "Belgrade", "London", "Lisbon"];
const INTERESTS = ["networking", "sport", "music", "travel", "ai", "design", "startups", "books"];

function randomFrom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomPhone(index: number) {
  return `+799990${String(index + 1).padStart(5, "0")}`;
}

function randomInterests() {
  const picked = new Set<string>();
  while (picked.size < 4) picked.add(randomFrom(INTERESTS));
  return [...picked];
}

function includesMissingColumn(errorMessage: string | undefined, column: string) {
  if (!errorMessage) return false;
  const m = errorMessage.toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

function includesMissingTable(errorMessage: string | undefined, table: string) {
  if (!errorMessage) return false;
  const m = errorMessage.toLowerCase();
  return m.includes(table.toLowerCase()) && (m.includes("does not exist") || m.includes("could not find") || m.includes("relation"));
}

function actionToEventName(action: string) {
  if (action === "event_joined") return "events.joined";
  if (action === "events_browse") return "events.viewed";
  if (action === "connect_sent" || action === "chaos_spam_connect_attempt") return "chat.connect_sent";
  if (action === "comment_created") return "comment.created";
  if (action === "browse_feed") return "app.session_start";
  return "qa.bots_action";
}

async function upsertSystemSetting(key: string, value: Record<string, unknown>, userId?: string) {
  await supabaseAdmin
    .from("system_settings")
    .upsert({ key, value, updated_by: userId ?? null, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function getSystemSetting<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin.from("system_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

async function tableExists(table: string, probeColumn = "id") {
  const probe = await supabaseAdmin.from(table).select(probeColumn, { count: "exact", head: true }).limit(1);
  if (!probe.error) return true;
  if (includesMissingTable(probe.error.message, table)) return false;
  return true;
}

export async function getMissingQaBotTables() {
  const checks = await Promise.all([
    tableExists("qa_bot_runs"),
    tableExists("qa_bot_heartbeats"),
    tableExists("qa_bot_logs"),
    tableExists("system_settings", "key"),
    tableExists("analytics_events"),
  ]);

  const names = ["qa_bot_runs", "qa_bot_heartbeats", "qa_bot_logs", "system_settings", "analytics_events"];
  return names.filter((_name, idx) => !checks[idx]);
}

async function selectQaBots() {
  const primary = await supabaseAdmin
    .from("users")
    .select("id,name,phone")
    .eq("is_demo", true)
    .eq("demo_group", "qa_bots")
    .order("created_at", { ascending: true })
    .limit(4000);

  if (!primary.error) return primary.data ?? [];

  if (!includesMissingColumn(primary.error.message, "demo_group")) {
    throw new Error(primary.error.message);
  }

  const fallback = await supabaseAdmin
    .from("users")
    .select("id,name,phone")
    .eq("is_demo", true)
    .ilike("name", "QA Bot%")
    .order("created_at", { ascending: true })
    .limit(4000);

  if (fallback.error) throw new Error(fallback.error.message);
  return fallback.data ?? [];
}

export async function ensureQaBotUsers(count = 30) {
  const { QA_BOTS_PASSWORD } = getServerEnv();

  const existing = await selectQaBots();
  if (existing.length >= count) {
    return existing.slice(0, count).map((u: any) => ({ id: u.id, name: u.name, phone: u.phone }));
  }

  const toCreate = count - existing.length;
  const created: Array<{ id: string; name: string; phone: string }> = [];

  for (let i = 0; i < toCreate; i += 1) {
    const idx = existing.length + i;
    const phone = randomPhone(idx);
    const id = randomUUID();
    const name = `QA Bot ${String(idx + 1).padStart(2, "0")}`;
    const city = randomFrom(CITIES);

    const row = {
      id,
      name,
      phone,
      telegram_verified: true,
      role: "user",
      is_demo: true,
      demo_group: "qa_bots",
      city,
      country: city,
      interests: randomInterests(),
      hobbies: ["qa", "automation", "networking"],
      facts: ["Автотестер", "Проверяет UI", "Собирает аналитику"],
      password_hash: hashPassword(QA_BOTS_PASSWORD),
      level: 1,
      xp: 0,
      profile_completed: true,
    };

    let inserted = await supabaseAdmin.from("users").insert(row);
    if (inserted.error && includesMissingColumn(inserted.error.message, "demo_group")) {
      const { demo_group: _skip, ...fallbackRow } = row;
      inserted = await supabaseAdmin.from("users").insert(fallbackRow);
    }

    if (!inserted.error) {
      created.push({ id, name, phone });
    }
  }

  return [...existing.map((u: any) => ({ id: u.id, name: u.name, phone: u.phone })), ...created].slice(0, count);
}

export async function startQaBots(input: {
  adminUserId: string;
  usersCount?: number;
  intervalSec?: number;
  mode?: QaMode;
}) {
  const usersCount = Math.max(1, Math.min(200, input.usersCount ?? 30));
  const intervalSec = Math.max(10, Math.min(60, input.intervalSec ?? 12));
  const mode = input.mode ?? "normal";

  const missingTables = await getMissingQaBotTables();
  if (missingTables.length) {
    throw new Error(`Cannot start QA Bots: missing tables ${missingTables.join(", ")}`);
  }

  const runId = randomUUID();

  await ensureQaBotUsers(usersCount);

  const runInsert = await supabaseAdmin.from("qa_bot_runs").insert({
    id: runId,
    status: "starting",
    users_count: usersCount,
    interval_sec: intervalSec,
    mode,
    requested_by: input.adminUserId,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (runInsert.error && !includesMissingTable(runInsert.error.message, "qa_bot_runs")) {
    throw new Error(runInsert.error.message);
  }

  await upsertSystemSetting(
    "qa_bots_control",
    {
      desired_status: "running",
      runtime_status: "STARTING",
      run_id: runId,
      users_count: usersCount,
      interval_sec: intervalSec,
      mode,
      requested_by: input.adminUserId,
      requested_at: new Date().toISOString(),
    },
    input.adminUserId,
  );

  return { run_id: runId, status: "STARTING" as const, users_count: usersCount, interval_sec: intervalSec, mode };
}

export async function stopQaBots(adminUserId: string) {
  const current = await getSystemSetting<Record<string, unknown>>("qa_bots_control");
  const runId = String(current?.run_id ?? "");

  if (runId) {
    const runUpdate = await supabaseAdmin
      .from("qa_bot_runs")
      .update({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", runId)
      .neq("status", "stopped");

    if (runUpdate.error && !includesMissingTable(runUpdate.error.message, "qa_bot_runs")) {
      throw new Error(runUpdate.error.message);
    }
  }

  await upsertSystemSetting(
    "qa_bots_control",
    {
      desired_status: "stopped",
      runtime_status: "STOPPED",
      run_id: runId || null,
      requested_by: adminUserId,
      requested_at: new Date().toISOString(),
    },
    adminUserId,
  );

  return { run_id: runId || null, status: "STOPPED" as const };
}

export async function getQaBotsProof(minutes = 2) {
  const safeMinutes = Math.max(1, Math.min(30, Math.floor(minutes)));
  const since = new Date(Date.now() - safeMinutes * 60 * 1000).toISOString();

  const [countRes, lastRes] = await Promise.all([
    supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .filter("properties->>demo_group", "eq", "qa_bots")
      .gte("created_at", since),
    supabaseAdmin
      .from("analytics_events")
      .select("created_at")
      .filter("properties->>demo_group", "eq", "qa_bots")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return {
    minutes: safeMinutes,
    events_last_window: countRes.count ?? 0,
    last_event_at: lastRes.data?.[0]?.created_at ?? null,
  };
}

export async function getQaBotLogs(input: { botId?: string; limit?: number }) {
  const limit = Math.max(10, Math.min(500, input.limit ?? 200));
  let query = supabaseAdmin.from("qa_bot_logs").select("id,bot_id,level,message,created_at,run_id").order("created_at", { ascending: false }).limit(limit);

  if (input.botId) query = query.eq("bot_id", input.botId);

  const { data, error } = await query;
  if (error && !includesMissingTable(error.message, "qa_bot_logs")) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getQaBotsStatus() {
  const control = await getSystemSetting<Record<string, unknown>>("qa_bots_control");

  const [runRes, heartbeatsRes, proof] = await Promise.all([
    supabaseAdmin
      .from("qa_bot_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("qa_bot_heartbeats")
      .select("bot_id,last_seen_at,status,last_action,last_error,updated_at")
      .not("bot_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500),
    getQaBotsProof(2),
  ]);

  const run = runRes.error ? null : runRes.data;
  const heartbeatRows = heartbeatsRes.error && includesMissingTable(heartbeatsRes.error.message, "qa_bot_heartbeats")
    ? []
    : (heartbeatsRes.data ?? []);

  const cutoff = Date.now() - 30_000;
  const aliveBots = heartbeatRows.filter((row: any) => {
    if (!row.last_seen_at) return false;
    return new Date(row.last_seen_at).getTime() > cutoff;
  }).length;

  const lastHeartbeatAt = heartbeatRows
    .map((row: any) => row.last_seen_at)
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  const desired = String(control?.desired_status ?? "stopped");
  const targetBots = Number(control?.users_count ?? run?.users_count ?? 30);

  let runtimeStatus: QaRuntimeStatus = "STOPPED";
  let runtimeReason = "QA bots stopped";

  if (desired === "running") {
    if (!lastHeartbeatAt) {
      runtimeStatus = "STARTING";
      runtimeReason = "Waiting first heartbeat from runner";
    } else if (aliveBots === 0) {
      runtimeStatus = "DEGRADED";
      runtimeReason = "RUNNING (NO HEARTBEAT)";
    } else if ((proof.events_last_window ?? 0) === 0) {
      runtimeStatus = "DEGRADED";
      runtimeReason = "Runner alive but not producing analytics events";
    } else {
      runtimeStatus = "RUNNING";
      runtimeReason = "Runner heartbeat and analytics stream are healthy";
    }
  }

  return {
    desired_status: desired,
    runtime_status: runtimeStatus,
    runtime_reason: runtimeReason,
    control: control ?? { desired_status: "stopped", runtime_status: "STOPPED" },
    run,
    target_bots: targetBots,
    alive_bots: aliveBots,
    heartbeat_rows: heartbeatRows,
    heartbeat_last_seen_at: lastHeartbeatAt,
    proof,
  };
}

export async function getRunnerDesiredState() {
  const control = await getSystemSetting<Record<string, unknown>>("qa_bots_control");
  return control ?? { desired_status: "stopped" };
}

export async function writeQaBotLogs(input: {
  runId?: string | null;
  logs: QaLogInput[];
}) {
  const rows = (input.logs ?? [])
    .filter((x: any) => x.bot_id && x.level && x.message)
    .slice(0, 200)
    .map((x: any) => ({
      bot_id: x.bot_id,
      run_id: input.runId ?? null,
      level: x.level,
      message: x.message.slice(0, 1200),
      created_at: new Date().toISOString(),
    }));

  if (!rows.length) return;

  const insert = await supabaseAdmin.from("qa_bot_logs").insert(rows);
  if (insert.error && !includesMissingTable(insert.error.message, "qa_bot_logs")) {
    throw new Error(insert.error.message);
  }
}

export async function writeRunnerHeartbeat(input: {
  runId?: string | null;
  activeBots: number;
  eventsWritten: number;
  actions?: RunnerAction[];
  botStates?: BotHeartbeatState[];
  logs?: QaLogInput[];
}) {
  const nowIso = new Date().toISOString();

  const states = (input.botStates ?? []).filter((x: any) => Boolean(x.bot_id)).slice(0, 400);
  if (states.length) {
    const rows = states.map((state: any) => ({
      bot_id: state.bot_id,
      run_id: input.runId ?? null,
      active_bots: input.activeBots,
      events_written: input.eventsWritten,
      actions: (input.actions ?? []).slice(0, 15),
      last_event_at: nowIso,
      last_seen_at: nowIso,
      status: state.status ?? "alive",
      last_action: state.last_action ?? null,
      last_error: state.last_error ?? null,
      updated_at: nowIso,
      created_at: nowIso,
    }));

    const upsert = await supabaseAdmin.from("qa_bot_heartbeats").upsert(rows, { onConflict: "bot_id" });
    if (upsert.error && !includesMissingColumn(upsert.error.message, "bot_id") && !includesMissingTable(upsert.error.message, "qa_bot_heartbeats")) {
      throw new Error(upsert.error.message);
    }
  }

  if (!states.length) {
    const heartbeatInsert = await supabaseAdmin.from("qa_bot_heartbeats").insert({
      run_id: input.runId ?? null,
      active_bots: input.activeBots,
      actions: input.actions ?? [],
      events_written: input.eventsWritten,
      last_event_at: nowIso,
      last_seen_at: nowIso,
      status: "alive",
      updated_at: nowIso,
    });

    if (heartbeatInsert.error && !includesMissingTable(heartbeatInsert.error.message, "qa_bot_heartbeats")) {
      throw new Error(heartbeatInsert.error.message);
    }
  }

  if (input.logs?.length) {
    await writeQaBotLogs({ runId: input.runId, logs: input.logs });
  }

  const actionRows = (input.actions ?? [])
    .filter((x: any) => Boolean(x.bot_id))
    .slice(0, 300)
    .map((x: any) => ({
      event_name: x.event_name ?? actionToEventName(x.action),
      user_id: x.bot_id,
      path: "/qa-bots",
      created_at: x.at ?? nowIso,
      properties: {
        demo_group: "qa_bots",
        bot_id: x.bot_id,
        bot_name: x.bot,
        action: x.action,
      },
    }));

  if (actionRows.length) {
    const eventsInsert = await supabaseAdmin.from("analytics_events").insert(actionRows);
    if (eventsInsert.error && !includesMissingTable(eventsInsert.error.message, "analytics_events")) {
      throw new Error(eventsInsert.error.message);
    }
  }

  if (input.runId) {
    await supabaseAdmin
      .from("qa_bot_runs")
      .update({
        status: input.activeBots > 0 ? "running" : "starting",
        updated_at: nowIso,
      })
      .eq("id", input.runId)
      .neq("status", "stopped");
  }

  const proof = await getQaBotsProof(2);

  await upsertSystemSetting("qa_bots_heartbeat", {
    run_id: input.runId ?? null,
    active_bots: input.activeBots,
    events_written: input.eventsWritten,
    actions: (input.actions ?? []).slice(-10),
    last_event_at: nowIso,
    last_seen_at: nowIso,
    db_events_last_2m: proof.events_last_window,
    proof_last_event_at: proof.last_event_at,
  });
}
