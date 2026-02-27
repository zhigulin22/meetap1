import { supabaseAdmin } from "@/supabase/admin";
import { assertSimulationTablesReady } from "@/server/admin-tables";

type SimMode = "normal" | "chaos";
type SimIntensity = "low" | "normal" | "high";

type SimUser = {
  user_id: string;
  persona: {
    activity_level: "ghost" | "normal" | "power";
    risk_profile: "normal" | "suspected";
    reply_speed: "fast" | "medium" | "slow";
    city: string;
    interests: string[];
    platform: "ios" | "android" | "web";
  };
};

type SimRun = {
  id: string;
  status: "running" | "stopped";
  users_count: number;
  interval_sec: number;
  mode: SimMode;
  intensity: SimIntensity;
  total_events_generated: number;
  recent_actions: string[];
  started_at: string | null;
  stopped_at: string | null;
  last_tick_at: string | null;
};

const CITIES = ["Moscow", "Dubai", "Tbilisi", "Berlin", "Warsaw", "Belgrade", "London", "Lisbon", "Almaty", "Yerevan"];
const INTERESTS = ["design", "startup", "music", "sport", "ai", "marketing", "product", "travel", "coffee", "books", "running", "cinema"];
const NAMES = ["Alex", "Mila", "Ivan", "Nina", "Artem", "Sofia", "Tim", "Daria", "Leo", "Mark", "Sam", "Eva", "Dan", "Alice", "Denis", "Ariana"];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[rnd(0, arr.length - 1)] as T;
}

function chance(probability: number) {
  return Math.random() < probability;
}

function phone() {
  return `+79${rnd(10, 99)}${rnd(100, 999)}${rnd(10, 99)}${rnd(10, 99)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isMissingColumnError(message: string, column: string) {
  const m = message.toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

export async function getDevtoolsStatus() {
  const isProd = process.env.NODE_ENV === "production";
  const enabledByEnv = process.env.ADMIN_DEVTOOLS_ENABLED === "true";
  if (!isProd) {
    return {
      enabled: true,
      reason: "development mode",
      mode: "development",
      fixSteps: [],
    } as const;
  }

  if (enabledByEnv) {
    return {
      enabled: true,
      reason: "ADMIN_DEVTOOLS_ENABLED=true",
      mode: "env",
      fixSteps: [],
    } as const;
  }

  const safeMode = await supabaseAdmin.from("system_settings").select("value").eq("key", "admin_devtools_safe_mode").maybeSingle();
  const safeEnabled = Boolean((safeMode.data?.value as Record<string, unknown> | null)?.enabled === true);

  if (safeEnabled) {
    return {
      enabled: true,
      reason: "safe mode enabled in system_settings",
      mode: "safe_mode",
      fixSteps: [],
    } as const;
  }

  return {
    enabled: false,
    reason: "production mode: set ADMIN_DEVTOOLS_ENABLED=true or enable safe mode",
    mode: "disabled",
    fixSteps: [
      "Set ADMIN_DEVTOOLS_ENABLED=true in Vercel and redeploy",
      "or run Auto-Fix: Enable DevTools in production (safe)",
    ],
  } as const;
}

export async function enableDevtoolsSafeMode(adminId: string) {
  await supabaseAdmin.from("system_settings").upsert({
    key: "admin_devtools_safe_mode",
    value: { enabled: true, enabled_by: adminId, enabled_at: nowIso() },
    updated_by: adminId,
    updated_at: nowIso(),
  });
}

export async function disableDevtoolsSafeMode(adminId: string) {
  await supabaseAdmin.from("system_settings").upsert({
    key: "admin_devtools_safe_mode",
    value: { enabled: false, disabled_by: adminId, disabled_at: nowIso() },
    updated_by: adminId,
    updated_at: nowIso(),
  });
}

function weightedPick(users: SimUser[]) {
  const weights = users.map((u) => {
    if (u.persona.activity_level === "power") return 4;
    if (u.persona.activity_level === "normal") return 2;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let ticket = Math.random() * total;
  for (let i = 0; i < users.length; i += 1) {
    ticket -= weights[i] ?? 1;
    if (ticket <= 0) return users[i] as SimUser;
  }
  return users[0] as SimUser;
}

function persona(): SimUser["persona"] {
  const roleDice = Math.random();
  const riskDice = Math.random();
  const speedDice = Math.random();

  const activity_level = roleDice < 0.3 ? "ghost" : roleDice < 0.8 ? "normal" : "power";
  const risk_profile = riskDice < 0.05 ? "suspected" : "normal";
  const reply_speed = speedDice < 0.3 ? "fast" : speedDice < 0.8 ? "medium" : "slow";

  return {
    activity_level,
    risk_profile,
    reply_speed,
    city: pick(CITIES),
    interests: Array.from(new Set(Array.from({ length: rnd(3, 6) }, () => pick(INTERESTS)))).slice(0, 6),
    platform: pick(["ios", "android", "web"] as const),
  };
}

async function queryDemoUsers(limit: number) {
  const byFlag = await supabaseAdmin
    .from("users")
    .select("id,name")
    .eq("role", "user")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!byFlag.error) return byFlag.data ?? [];

  const byName = await supabaseAdmin
    .from("users")
    .select("id,name")
    .eq("role", "user")
    .ilike("name", "Demo %")
    .order("created_at", { ascending: false })
    .limit(limit);

  return byName.data ?? [];
}

async function createUsersIfNeeded(target: number) {
  const existing = await queryDemoUsers(target);
  if (existing.length >= target) return existing.map((u) => u.id);

  const need = target - existing.length;
  const fullRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < need; i += 1) {
    const base = `${pick(NAMES)} ${String.fromCharCode(65 + (i % 26))}.`;
    const city = pick(CITIES);
    fullRows.push({
      name: `Demo ${base}`,
      phone: phone(),
      telegram_verified: chance(0.75),
      profile_completed: chance(0.65),
      role: "user",
      is_demo: true,
      city,
      country: city,
      interests: Array.from(new Set(Array.from({ length: rnd(3, 5) }, () => pick(INTERESTS)))),
      hobbies: Array.from(new Set(Array.from({ length: rnd(2, 4) }, () => pick(INTERESTS)))),
      facts: ["Demo user", "Seeded by simulation", "Safe for testing"],
      bio: "Demo persona for admin simulation and analytics.",
    });
  }

  const fallbackRows = fullRows.map((x) => {
    const copy = { ...x };
    delete copy.is_demo;
    delete copy.city;
    return copy;
  });

  for (let i = 0; i < fullRows.length; i += 200) {
    const chunk = fullRows.slice(i, i + 200);
    const { error } = await supabaseAdmin.from("users").insert(chunk);
    if (!error) continue;

    if (isMissingColumnError(error.message, "is_demo") || isMissingColumnError(error.message, "city")) {
      const fallback = fallbackRows.slice(i, i + 200);
      const fallbackResult = await supabaseAdmin.from("users").insert(fallback);
      if (fallbackResult.error) throw new Error(fallbackResult.error.message);
      continue;
    }

    throw new Error(error.message);
  }

  const after = await queryDemoUsers(target);
  return after.map((x) => x.id);
}

async function ensureSimulationUsers(runId: string, usersCount: number): Promise<SimUser[]> {
  const { data: linked } = await supabaseAdmin.from("simulation_users").select("user_id,persona").eq("sim_run_id", runId).limit(5000);
  let rows = (linked ?? []) as Array<{ user_id: string; persona: Record<string, unknown> | null }>;

  if (rows.length < usersCount) {
    const ids = await createUsersIfNeeded(usersCount);
    const existingSet = new Set(rows.map((x) => x.user_id));
    const missing = ids.filter((id) => !existingSet.has(id)).slice(0, Math.max(0, usersCount - rows.length));

    if (missing.length) {
      const inserts = missing.map((id) => ({
        sim_run_id: runId,
        user_id: id,
        persona: persona(),
      }));
      await supabaseAdmin.from("simulation_users").insert(inserts);
    }

    const refresh = await supabaseAdmin.from("simulation_users").select("user_id,persona").eq("sim_run_id", runId).limit(5000);
    rows = (refresh.data ?? []) as Array<{ user_id: string; persona: Record<string, unknown> | null }>;
  }

  return rows.slice(0, usersCount).map((row) => ({
    user_id: row.user_id,
    persona: {
      activity_level: ((row.persona?.activity_level as string) ?? "normal") as "ghost" | "normal" | "power",
      risk_profile: ((row.persona?.risk_profile as string) ?? "normal") as "normal" | "suspected",
      reply_speed: ((row.persona?.reply_speed as string) ?? "medium") as "fast" | "medium" | "slow",
      city: (row.persona?.city as string) ?? pick(CITIES),
      interests: Array.isArray(row.persona?.interests) ? (row.persona?.interests as string[]) : ["networking"],
      platform: ((row.persona?.platform as string) ?? "web") as "ios" | "android" | "web",
    },
  }));
}

export async function getSimulationState() {
  const active = await supabaseAdmin
    .from("simulation_runs")
    .select("id,status,users_count,interval_sec,mode,intensity,total_events_generated,recent_actions,started_at,stopped_at,last_tick_at")
    .eq("status", "running")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active.data) {
    return {
      run: {
        ...active.data,
        recent_actions: Array.isArray(active.data.recent_actions) ? active.data.recent_actions : [],
      } as SimRun,
      running: true,
    };
  }

  const last = await supabaseAdmin
    .from("simulation_runs")
    .select("id,status,users_count,interval_sec,mode,intensity,total_events_generated,recent_actions,started_at,stopped_at,last_tick_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    run: last.data
      ? ({ ...last.data, recent_actions: Array.isArray(last.data.recent_actions) ? last.data.recent_actions : [] } as SimRun)
      : null,
    running: false,
  };
}

export async function startSimulation(input: {
  adminId: string;
  usersCount: number;
  intervalSec: number;
  mode: SimMode;
  intensity: SimIntensity;
}) {
  await assertSimulationTablesReady();
  await supabaseAdmin.from("simulation_runs").update({ status: "stopped", stopped_at: nowIso(), updated_at: nowIso() }).eq("status", "running");

  const { data, error } = await supabaseAdmin
    .from("simulation_runs")
    .insert({
      status: "running",
      users_count: input.usersCount,
      interval_sec: input.intervalSec,
      mode: input.mode,
      intensity: input.intensity,
      started_at: nowIso(),
      created_by: input.adminId,
      recent_actions: [],
      total_events_generated: 0,
    })
    .select("id,status,users_count,interval_sec,mode,intensity,total_events_generated,recent_actions,started_at,stopped_at,last_tick_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to start simulation");
  await ensureSimulationUsers(data.id, input.usersCount);
  return data as SimRun;
}

export async function stopSimulation(runId?: string) {
  if (runId) {
    await supabaseAdmin.from("simulation_runs").update({ status: "stopped", stopped_at: nowIso(), updated_at: nowIso() }).eq("id", runId);
    return;
  }
  await supabaseAdmin.from("simulation_runs").update({ status: "stopped", stopped_at: nowIso(), updated_at: nowIso() }).eq("status", "running");
}

function eventCountPerTick(usersCount: number, intensity: SimIntensity, mode: SimMode) {
  const base = intensity === "low" ? Math.round(usersCount * 1.2) : intensity === "high" ? Math.round(usersCount * 4) : Math.round(usersCount * 2.4);
  return mode === "chaos" ? Math.round(base * 1.4) : base;
}

function addStats(map: Map<string, Record<string, number | boolean>>, userId: string, eventName: string, createdAt: string) {
  const day = createdAt.slice(0, 10);
  const key = `${userId}:${day}`;
  const stat = map.get(key) ?? {
    dau: false,
    posts: 0,
    event_views: 0,
    event_joins: 0,
    connects_sent: 0,
    connects_replied: 0,
    msgs_sent: 0,
    endorsements_received: 0,
    reports_received: 0,
  };

  stat.dau = true;
  if (eventName === "post_published_daily_duo" || eventName === "post_published_video") stat.posts = Number(stat.posts) + 1;
  if (eventName === "event_viewed") stat.event_views = Number(stat.event_views) + 1;
  if (eventName === "event_joined") stat.event_joins = Number(stat.event_joins) + 1;
  if (eventName === "connect_sent") stat.connects_sent = Number(stat.connects_sent) + 1;
  if (eventName === "connect_replied") stat.connects_replied = Number(stat.connects_replied) + 1;
  if (eventName === "message_sent") stat.msgs_sent = Number(stat.msgs_sent) + 1;
  if (eventName === "endorsement_sent") stat.endorsements_received = Number(stat.endorsements_received) + 1;
  if (eventName === "report_created") stat.reports_received = Number(stat.reports_received) + 1;

  map.set(key, stat);
}

export async function runSimulationTick(runId: string, forceEventsPerTick?: number) {
  await assertSimulationTablesReady();
  const runRes = await supabaseAdmin
    .from("simulation_runs")
    .select("id,status,users_count,interval_sec,mode,intensity,total_events_generated,recent_actions,started_at,stopped_at,last_tick_at")
    .eq("id", runId)
    .single();

  if (runRes.error || !runRes.data) throw new Error(runRes.error?.message ?? "Run not found");
  const run = runRes.data as SimRun;

  const users = await ensureSimulationUsers(run.id, run.users_count);
  if (!users.length) throw new Error("No simulation users");

  const total = forceEventsPerTick ?? eventCountPerTick(run.users_count, run.intensity, run.mode);
  const rows: Array<{ event_name: string; user_id: string; path: string; properties: Record<string, unknown>; created_at: string }> = [];
  const stats = new Map<string, Record<string, number | boolean>>();
  const actions: string[] = [];

  const riskyUserIds = users.filter((u) => u.persona.risk_profile === "suspected").map((x) => x.user_id);
  const spammer = riskyUserIds[0] ?? users[0]?.user_id;

  for (let i = 0; i < total; i += 1) {
    const u = weightedPick(users);
    const p = Math.random();
    let eventName: string;

    if (p < 0.4) {
      eventName = "event_viewed";
    } else if (p < 0.6) {
      eventName = "event_joined";
    } else if (p < 0.72) {
      eventName = chance(0.55) ? "post_published_daily_duo" : "post_published_video";
    } else if (p < 0.87) {
      eventName = "connect_sent";
    } else if (p < 0.95) {
      const canReply = u.persona.reply_speed === "fast" ? chance(0.65) : u.persona.reply_speed === "medium" ? chance(0.45) : chance(0.28);
      eventName = canReply ? "connect_replied" : "message_sent";
    } else {
      eventName = "report_created";
    }

    if (chance(0.02)) eventName = "register_started";
    if (chance(0.015) && run.mode !== "chaos") eventName = "telegram_verified";
    if (chance(0.012)) eventName = "registration_completed";
    if (chance(0.01)) eventName = "profile_completed";

    const createdAt = nowIso();
    const properties: Record<string, unknown> = {
      source: "live_sim",
      is_demo: true,
      demo_run_id: run.id,
      city: u.persona.city,
      platform: u.persona.platform,
      event_id: `sim_event_${rnd(1, 50)}`,
      message_hash: `h_${rnd(1, 600)}`,
      mode: run.mode,
      intensity: run.intensity,
    };

    rows.push({
      event_name: eventName,
      user_id: u.user_id,
      path: eventName.includes("event") ? "/events" : eventName.includes("connect") || eventName === "message_sent" ? "/contacts" : "/feed",
      properties,
      created_at: createdAt,
    });

    addStats(stats, u.user_id, eventName, createdAt);
    if (actions.length < 10) actions.push(`User ${u.user_id.slice(0, 6)}: ${eventName}`);
  }

  if (run.mode === "chaos" && spammer) {
    for (let i = 0; i < 20; i += 1) {
      const createdAt = nowIso();
      rows.push({
        event_name: "connect_sent",
        user_id: spammer,
        path: "/contacts",
        properties: {
          source: "live_sim",
          mode: "chaos",
          is_demo: true,
          demo_run_id: run.id,
          message_hash: "same_spam_hash",
          city: pick(CITIES),
          platform: "web",
        },
        created_at: createdAt,
      });
      addStats(stats, spammer, "connect_sent", createdAt);
    }

    const target = users[rnd(0, users.length - 1)]?.user_id;
    if (target) {
      for (let i = 0; i < 5; i += 1) {
        const createdAt = nowIso();
        rows.push({
          event_name: "report_created",
          user_id: target,
          path: "/reports",
          properties: { source: "live_sim", mode: "chaos", is_demo: true, demo_run_id: run.id, reason: "spam_wave" },
          created_at: createdAt,
        });
        addStats(stats, target, "report_created", createdAt);
      }

      await supabaseAdmin.from("risk_signals").insert({
        user_id: spammer,
        signal_key: "chaos_spam_wave",
        value: 1,
        severity: 5,
        evidence: { target, repeated_message_hashes: 20, connect_sent_burst: true },
      });
    }

    actions.unshift("CHAOS: spam burst + reports spike generated");
  }

  let eventsWritten = 0;
  let lastDbEventAt: string | null = null;
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabaseAdmin.from("analytics_events").insert(chunk);
    if (error) throw new Error(error.message);
    eventsWritten += chunk.length;
    lastDbEventAt = chunk[chunk.length - 1]?.created_at ?? lastDbEventAt;
  }

  const statRows = [...stats.entries()].map(([key, stat]) => {
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

  if (statRows.length) {
    await supabaseAdmin.from("user_stats_daily").upsert(statRows, { onConflict: "user_id,day" });
  }

  await supabaseAdmin
    .from("simulation_runs")
    .update({
      last_tick_at: nowIso(),
      total_events_generated: Number(run.total_events_generated ?? 0) + eventsWritten,
      recent_actions: actions,
      updated_at: nowIso(),
    })
    .eq("id", run.id);

  return {
    eventsWritten,
    sampleEvents: actions.slice(0, 10),
    runId: run.id,
    dbWritten: eventsWritten > 0,
    lastDbEventAt,
  };
}

export async function runSimulationCronTick() {
  const state = await getSimulationState();
  if (!state.running || !state.run) return { ran: false, reason: "no running simulation" };

  const last = state.run.last_tick_at ? new Date(state.run.last_tick_at).getTime() : 0;
  const diff = Date.now() - last;
  if (diff < state.run.interval_sec * 1000) {
    return { ran: false, reason: "interval not reached", runId: state.run.id };
  }

  const result = await runSimulationTick(state.run.id);
  return { ran: true, ...result };
}

export async function seedMinimalData() {
  const users = await createUsersIfNeeded(10);

  const existingEvents = await supabaseAdmin.from("events").select("id", { count: "exact" }).limit(2);
  if ((existingEvents.count ?? 0) < 2) {
    await supabaseAdmin.from("events").insert([
      {
        title: "Meetap Demo Breakfast",
        description: "Demo event for analytics and joins",
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        price: 0,
        cover_url: null,
        location: "Moscow",
      },
      {
        title: "Meetap Demo Product Talk",
        description: "Demo event for social graph",
        date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        price: 0,
        cover_url: null,
        location: "Tbilisi",
      },
    ]);
  }

  const rows: Array<{ event_name: string; user_id: string; path: string; properties: Record<string, unknown>; created_at: string }> = [];
  const names = [
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
    "message_sent",
    "report_created",
  ] as const;

  for (let i = 0; i < 100; i += 1) {
    const userId = users[rnd(0, users.length - 1)] as string;
    const name = pick([...names]);
    rows.push({
      event_name: name,
      user_id: userId,
      path: name.includes("event") ? "/events" : name.includes("connect") || name === "message_sent" ? "/contacts" : "/feed",
      properties: {
        source: "seed_minimal",
        is_demo: true,
        city: pick(CITIES),
        platform: pick(["ios", "android", "web"]),
        event_id: `seed_event_${rnd(1, 5)}`,
        message_hash: `seed_${rnd(1, 50)}`,
      },
      created_at: new Date(Date.now() - rnd(0, 12) * 60 * 60 * 1000).toISOString(),
    });
  }

  const insertRes = await supabaseAdmin.from("analytics_events").insert(rows);
  if (insertRes.error) throw new Error(insertRes.error.message);
  return { users: users.length, events: rows.length };
}
