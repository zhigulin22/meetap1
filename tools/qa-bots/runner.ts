import { chromium, type Browser, type Page } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "";
const controlToken = process.env.QA_BOTS_CONTROL_TOKEN ?? "";
const qaPassword = process.env.QA_BOTS_PASSWORD ?? "QaBots!2026";
const pollMs = Number(process.env.QA_BOTS_POLL_MS ?? 8000);

if (!baseUrl || !controlToken) {
  // eslint-disable-next-line no-console
  console.error("Missing APP_BASE_URL or QA_BOTS_CONTROL_TOKEN");
  process.exit(1);
}

type BotAccount = { id: string; name: string; phone: string };
type BotSession = { account: BotAccount; page: Page };

type RunnerState = {
  desired_status?: "running" | "stopped";
  run_id?: string | null;
  users_count?: number;
  interval_sec?: number;
  mode?: "normal" | "chaos";
};

let browser: Browser | null = null;
let sessions: BotSession[] = [];
let currentRunId: string | null = null;
let eventsWritten = 0;

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

async function loginBot(page: Page, account: BotAccount) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("+79990000000").fill(account.phone);
  await page.getByPlaceholder("Пароль").fill(qaPassword);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForTimeout(700);
}

async function browseFeed(page: Page) {
  await page.goto(`${baseUrl}/feed`, { waitUntil: "domcontentloaded" });
  const scrolls = randomInt(4, 12);
  for (let i = 0; i < scrolls; i += 1) {
    await page.mouse.wheel(0, randomInt(300, 800));
    await delay(randomInt(300, 1200));
  }
  return "browse_feed";
}

async function openEventsAndJoin(page: Page) {
  await page.goto(`${baseUrl}/events`, { waitUntil: "domcontentloaded" });
  const joinButton = page.getByRole("button", { name: "Я иду" }).first();
  if ((await joinButton.count()) > 0) {
    await joinButton.click({ timeout: 2000 }).catch(() => null);
    await delay(randomInt(500, 1400));
    return "event_joined";
  }
  await delay(randomInt(400, 1000));
  return "events_browse";
}

async function connectInContacts(page: Page) {
  await page.goto(`${baseUrl}/contacts`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Хочу познакомиться" }).first();
  if ((await button.count()) > 0) {
    await button.click({ timeout: 2500 }).catch(() => null);
    await delay(randomInt(500, 1200));
    return "connect_sent";
  }
  return "contacts_browse";
}

async function writeComment(page: Page) {
  await page.goto(`${baseUrl}/feed`, { waitUntil: "domcontentloaded" });
  const commentOpenButton = page.locator("button").filter({ has: page.locator("svg.lucide-message-circle") }).first();
  if ((await commentOpenButton.count()) === 0) return "comment_skip";

  await commentOpenButton.click({ timeout: 2000 }).catch(() => null);
  const input = page.getByPlaceholder("Напиши комментарий");
  if ((await input.count()) === 0) return "comment_skip";

  const message = pick([
    "Классный пост, спасибо!",
    "Интересно, хочу познакомиться ближе",
    "Тоже был на похожем мероприятии",
    "Отличная идея для офлайн встречи",
  ]);
  await input.fill(message);
  await page.getByRole("button", { name: "Отправить" }).click().catch(() => null);
  await delay(randomInt(400, 1200));
  return "comment_created";
}

async function performRandomScenario(session: BotSession) {
  const scenarios = [browseFeed, openEventsAndJoin, connectInContacts, writeComment];
  const fn = pick(scenarios);
  const action = await fn(session.page).catch(() => "action_failed");
  return { bot: session.account.name, action, at: new Date().toISOString() };
}

async function startSessions(count: number) {
  const botsData = await controlRequest<{ bots: BotAccount[] }>(`/api/admin/qa-bots/agent/bots?count=${count}`);
  const bots = botsData.bots.slice(0, count);

  browser = await chromium.launch({ headless: true });
  sessions = [];

  for (const account of bots) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginBot(page, account).catch(() => null);
    sessions.push({ account, page });
    await delay(randomInt(120, 420));
  }
}

async function stopSessions() {
  for (const s of sessions) {
    await s.page.context().close().catch(() => null);
  }
  sessions = [];

  if (browser) {
    await browser.close().catch(() => null);
    browser = null;
  }
}

async function sendHeartbeat(actions: Array<{ bot: string; action: string; at: string }>) {
  await controlRequest("/api/admin/qa-bots/agent/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      run_id: currentRunId,
      active_bots: sessions.length,
      events_written: eventsWritten,
      actions,
    }),
  });
}

async function tick(state: RunnerState) {
  const actions: Array<{ bot: string; action: string; at: string }> = [];
  const active = sessions.slice(0, Math.max(1, Math.floor(sessions.length * 0.4)));

  for (const s of active) {
    actions.push(await performRandomScenario(s));
    eventsWritten += 1;
    await delay(randomInt(200, 900));
  }

  if (state.mode === "chaos" && sessions.length) {
    const chaotic = sessions[0];
    actions.push({ bot: chaotic.account.name, action: "chaos_spam_connect_attempt", at: new Date().toISOString() });
    await chaotic.page.goto(`${baseUrl}/contacts`, { waitUntil: "domcontentloaded" }).catch(() => null);
    for (let i = 0; i < 3; i += 1) {
      await chaotic.page.getByRole("button", { name: "Хочу познакомиться" }).first().click({ timeout: 1500 }).catch(() => null);
      await delay(120);
    }
    eventsWritten += 3;
  }

  await sendHeartbeat(actions.slice(-10));
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
      }

      if (desired === "stopped" && sessions.length > 0) {
        await stopSessions();
        currentRunId = null;
        await sendHeartbeat([]);
      }

      if (desired === "running" && sessions.length > 0) {
        await tick(state);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Runner error", error instanceof Error ? error.message : error);
    }

    await delay(pollMs);
  }
}

void main();
