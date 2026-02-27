import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/password";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";

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
  return m.includes(table.toLowerCase()) && (m.includes("does not exist") || m.includes("could not find"));
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
    return existing.slice(0, count).map((u) => ({ id: u.id, name: u.name, phone: u.phone }));
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

  return [...existing.map((u) => ({ id: u.id, name: u.name, phone: u.phone })), ...created].slice(0, count);
}

export async function startQaBots(input: {
  adminUserId: string;
  usersCount?: number;
  intervalSec?: number;
  mode?: "normal" | "chaos";
}) {
  const usersCount = Math.max(1, Math.min(200, input.usersCount ?? 30));
  const intervalSec = Math.max(2, Math.min(60, input.intervalSec ?? 8));
  const mode = input.mode ?? "normal";

  const runId = randomUUID();

  await ensureQaBotUsers(usersCount);

  const runInsert = await supabaseAdmin.from("qa_bot_runs").insert({
    id: runId,
    status: "running",
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
      run_id: runId,
      users_count: usersCount,
      interval_sec: intervalSec,
      mode,
      requested_by: input.adminUserId,
      requested_at: new Date().toISOString(),
    },
    input.adminUserId,
  );

  return { run_id: runId, status: "running" as const, users_count: usersCount, interval_sec: intervalSec, mode };
}

export async function stopQaBots(adminUserId: string) {
  const current = await getSystemSetting<Record<string, unknown>>("qa_bots_control");
  const runId = String(current?.run_id ?? "");

  if (runId) {
    const runUpdate = await supabaseAdmin
      .from("qa_bot_runs")
      .update({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("status", "running");

    if (runUpdate.error && !includesMissingTable(runUpdate.error.message, "qa_bot_runs")) {
      throw new Error(runUpdate.error.message);
    }
  }

  await upsertSystemSetting(
    "qa_bots_control",
    {
      desired_status: "stopped",
      run_id: runId || null,
      requested_by: adminUserId,
      requested_at: new Date().toISOString(),
    },
    adminUserId,
  );

  return { run_id: runId || null, status: "stopped" as const };
}

export async function getQaBotsStatus() {
  const control = await getSystemSetting<Record<string, unknown>>("qa_bots_control");
  const heartbeat = await getSystemSetting<Record<string, unknown>>("qa_bots_heartbeat");

  const runRes = await supabaseAdmin
    .from("qa_bot_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const run = runRes.error ? null : runRes.data;

  let activeBots = 0;
  try {
    activeBots = (await selectQaBots()).length;
  } catch {
    activeBots = 0;
  }

  return {
    control: control ?? { desired_status: "stopped" },
    heartbeat: heartbeat ?? null,
    run,
    active_bots: activeBots,
  };
}

export async function getRunnerDesiredState() {
  const control = await getSystemSetting<Record<string, unknown>>("qa_bots_control");
  return control ?? { desired_status: "stopped" };
}

export async function writeRunnerHeartbeat(input: {
  runId?: string | null;
  activeBots: number;
  eventsWritten: number;
  actions?: Array<{ bot: string; action: string; at: string }>;
}) {
  const heartbeatInsert = await supabaseAdmin.from("qa_bot_heartbeats").insert({
    run_id: input.runId ?? null,
    active_bots: input.activeBots,
    events_written: input.eventsWritten,
    actions: input.actions ?? [],
    last_event_at: new Date().toISOString(),
  });

  if (heartbeatInsert.error && !includesMissingTable(heartbeatInsert.error.message, "qa_bot_heartbeats")) {
    throw new Error(heartbeatInsert.error.message);
  }

  await upsertSystemSetting("qa_bots_heartbeat", {
    run_id: input.runId ?? null,
    active_bots: input.activeBots,
    events_written: input.eventsWritten,
    actions: input.actions ?? [],
    last_event_at: new Date().toISOString(),
  });
}
