import { chromium, type Browser, type Page } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "";
const controlToken = process.env.QA_BOTS_CONTROL_TOKEN ?? "";
const qaPassword = process.env.QA_BOTS_PASSWORD ?? "QaBots!2026";
const rawPollMs = Number(process.env.QA_BOTS_POLL_MS ?? 12000);
const pollMs = Math.max(10_000, Math.min(20_000, Number.isFinite(rawPollMs) ? rawPollMs : 12_000));

if (!baseUrl || !controlToken) {
  // eslint-disable-next-line no-console
  console.error("Missing APP_BASE_URL or QA_BOTS_CONTROL_TOKEN");
  process.exit(1);
}

type BotAccount = { id: string; name: string; phone: string };

type RunnerState = {
  desired_status?: "running" | "stopped";
  run_id?: string | null;
  users_count?: number;
  interval_sec?: number;
  mode?: "normal" | "chaos";
};

type RunnerAction = {
  bot_id: string;
  bot: string;
  action: string;
  at: string;
  event_name?: string;
};

type BotRuntimeState = {
  bot_id: string;
  status: "alive" | "error" | "idle";
  last_action: string;
  last_error: string | null;
  updated_at: string;
};

type BotSession = {
  account: BotAccount;
  page: Page;
};

let browser: Browser | null = null;
let sessions: BotSession[] = [];
let currentRunId: string | null = null;
let eventsWritten = 0;
const botStateMap = new Map<string, BotRuntimeState>();

async function controlRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-qa-control-token": controlToken,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Request failed: ${res.status}`);
  }
  return payload as T;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[randomInt(0, arr.length - 1)] as T;
}

function setBotState(botId: string, patch: Partial<BotRuntimeState>) {
  const prev = botStateMap.get(botId);
  const next: BotRuntimeState = {
    bot_id: botId,
    status: patch.status ?? prev?.status ?? "idle",
    last_action: patch.last_action ?? prev?.last_action ?? "idle",
    last_error: patch.last_error ?? prev?.last_error ?? null,
    updated_at: new Date().toISOString(),
  };
  botStateMap.set(botId, next);
}

async function pushLogs(logs: Array<{ bot_id: string; level: "info" | "warn" | "error"; message: string }>) {
  if (!logs.length) return;
  await controlRequest("/api/admin/qa-bots/agent/log", {
    method: "POST",
    body: JSON.stringify({ run_id: currentRunId, logs: logs.slice(0, 200) }),
  }).catch(() => null);
}

async function logBotError(account: BotAccount, message: string) {
  setBotState(account.id, { status: "error", last_action: "error", last_error: message.slice(0, 1000) });
  await pushLogs([{ bot_id: account.id, level: "error", message: `${account.name}: ${message}` }]);
}

async function loginBot(page: Page, account: BotAccount) {
  const demoLoginUrl = `${baseUrl}/api/auth/demo-login?bot_id=${encodeURIComponent(account.id)}`;
  const demoRes = await page.goto(demoLoginUrl, { waitUntil: "domcontentloaded" }).catch(() => null);

  if (demoRes && demoRes.status() < 400) {
    await page.goto(`${baseUrl}/feed`, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/register") || page.url().includes("/login")) {
      throw new Error("demo-login redirect failed to keep auth session");
    }
    setBotState(account.id, { status: "alive", last_action: "demo_login_success", last_error: null });
    return;
  }

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("+79990000000").fill(account.phone);
  await page.getByPlaceholder("Пароль").fill(qaPassword);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForTimeout(700);

  if (page.url().includes("/login") || page.url().includes("/register")) {
    throw new Error("password login failed");
  }

  setBotState(account.id, { status: "alive", last_action: "password_login_success", last_error: null });
}

async function browseFeed(session: BotSession) {
  const page = session.page;
  await page.goto(`${baseUrl}/feed`, { waitUntil: "domcontentloaded" });
  const scrolls = randomInt(4, 12);
  for (let i = 0; i < scrolls; i += 1) {
    await page.mouse.wheel(0, randomInt(300, 800));
    await delay(randomInt(300, 1200));
  }
  return { action: "browse_feed", event_name: "app.session_start" };
}

async function openEventsAndJoin(session: BotSession) {
  const page = session.page;
  await page.goto(`${baseUrl}/events`, { waitUntil: "domcontentloaded" });
  const joinButton = page.getByRole("button", { name: "Я иду" }).first();
  if ((await joinButton.count()) > 0) {
    await joinButton.click({ timeout: 2000 }).catch(() => null);
    await delay(randomInt(500, 1400));
    return { action: "event_joined", event_name: "events.joined" };
  }
  await delay(randomInt(400, 1000));
  return { action: "events_browse", event_name: "events.viewed" };
}

async function connectInContacts(session: BotSession) {
  const page = session.page;
  await page.goto(`${baseUrl}/contacts`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Хочу познакомиться" }).first();
  if ((await button.count()) > 0) {
    await button.click({ timeout: 2500 }).catch(() => null);
    await delay(randomInt(500, 1200));
    return { action: "connect_sent", event_name: "chat.connect_sent" };
  }
  return { action: "contacts_browse", event_name: "events.viewed" };
}

async function writeComment(session: BotSession) {
  const page = session.page;
  await page.goto(`${baseUrl}/feed`, { waitUntil: "domcontentloaded" });
  const commentOpenButton = page.locator("button").filter({ has: page.locator("svg.lucide-message-circle") }).first();
  if ((await commentOpenButton.count()) === 0) return { action: "comment_skip", event_name: "app.session_start" };

  await commentOpenButton.click({ timeout: 2000 }).catch(() => null);
  const input = page.getByPlaceholder("Напиши комментарий");
  if ((await input.count()) === 0) return { action: "comment_skip", event_name: "app.session_start" };

  const message = pick([
    "Классный пост, спасибо!",
    "Интересно, хочу познакомиться ближе",
    "Тоже был на похожем мероприятии",
    "Отличная идея для офлайн встречи",
  ]);
  await input.fill(message);
  await page.getByRole("button", { name: "Отправить" }).click().catch(() => null);
  await delay(randomInt(400, 1200));
  return { action: "comment_created", event_name: "comment.created" };
}

async function performRandomScenario(session: BotSession): Promise<RunnerAction> {
  const account = session.account;
  try {
    const scenarios = [browseFeed, openEventsAndJoin, connectInContacts, writeComment];
    const fn = pick(scenarios);
    const result = await fn(session);

    setBotState(account.id, {
      status: "alive",
      last_action: result.action,
      last_error: null,
    });

    return {
      bot_id: account.id,
      bot: account.name,
      action: result.action,
      at: new Date().toISOString(),
      event_name: result.event_name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scenario_failed";
    await logBotError(account, message);
    return {
      bot_id: account.id,
      bot: account.name,
      action: "action_failed",
      at: new Date().toISOString(),
      event_name: "qa.bots_action",
    };
  }
}

async function startSessions(count: number) {
  const botsData = await controlRequest<{ bots: BotAccount[] }>(`/api/admin/qa-bots/agent/bots?count=${count}`);
  const bots = botsData.bots.slice(0, count);

  browser = await chromium.launch({ headless: true });
  sessions = [];

  for (const account of bots) {
    const context = await browser.newContext();
    const page = await context.newPage();

    setBotState(account.id, { status: "idle", last_action: "starting" });

    try {
      await loginBot(page, account);
      sessions.push({ account, page });
    } catch (error) {
      await logBotError(account, error instanceof Error ? error.message : "login_failed");
      await context.close().catch(() => null);
    }

    await delay(randomInt(120, 420));
  }
}

async function stopSessions() {
  for (const s of sessions) {
    setBotState(s.account.id, { status: "idle", last_action: "stopped", last_error: null });
    await s.page.context().close().catch(() => null);
  }
  sessions = [];

  if (browser) {
    await browser.close().catch(() => null);
    browser = null;
  }
}

async function sendHeartbeat(actions: RunnerAction[], logs: Array<{ bot_id: string; level: "info" | "warn" | "error"; message: string }> = []) {
  await controlRequest("/api/admin/qa-bots/agent/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      run_id: currentRunId,
      active_bots: sessions.length,
      events_written: eventsWritten,
      actions,
      logs,
      bot_states: [...botStateMap.values()],
    }),
  });
}

async function tick(state: RunnerState) {
  const actions: RunnerAction[] = [];
  const active = sessions.slice(0, Math.max(1, Math.floor(sessions.length * 0.4)));

  for (const s of active) {
    const action = await performRandomScenario(s);
    actions.push(action);
    eventsWritten += 1;
    await delay(randomInt(200, 900));
  }

  if (state.mode === "chaos" && sessions.length) {
    const chaotic = sessions[0] as BotSession;
    actions.push({
      bot_id: chaotic.account.id,
      bot: chaotic.account.name,
      action: "chaos_spam_connect_attempt",
      at: new Date().toISOString(),
      event_name: "chat.connect_sent",
    });

    await chaotic.page.goto(`${baseUrl}/contacts`, { waitUntil: "domcontentloaded" }).catch(() => null);
    for (let i = 0; i < 3; i += 1) {
      await chaotic.page.getByRole("button", { name: "Хочу познакомиться" }).first().click({ timeout: 1500 }).catch(() => null);
      await delay(120);
    }

    setBotState(chaotic.account.id, {
      status: "alive",
      last_action: "chaos_spam_connect_attempt",
      last_error: null,
    });

    eventsWritten += 3;
  }

  await sendHeartbeat(actions.slice(-30));
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("QA bots runner started", { baseUrl, pollMs });

  while (true) {
    try {
      const stateRes = await controlRequest<{ ok: boolean; state: RunnerState }>("/api/admin/qa-bots/agent/state");
      const state = stateRes.state ?? { desired_status: "stopped" };
      const desired = state.desired_status ?? "stopped";

      if (desired === "running" && sessions.length === 0) {
        currentRunId = state.run_id ?? null;
        eventsWritten = 0;
        await startSessions(state.users_count ?? 30);
        await sendHeartbeat([]);
      }

      if (desired === "stopped" && sessions.length > 0) {
        await stopSessions();
        currentRunId = null;
        await sendHeartbeat([]);
      }

      if (desired === "running") {
        if (sessions.length > 0) {
          await tick(state);
        } else {
          await sendHeartbeat([], [{ bot_id: "runner", level: "warn", message: "No active bot sessions after start" }]);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runner error";
      // eslint-disable-next-line no-console
      console.error("Runner error", message);
      await pushLogs([{ bot_id: "runner", level: "error", message }]);
    }

    await delay(pollMs);
  }
}

void main();
