import { failAdmin, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getLastHealthError, setLastHealthError } from "@/server/admin-health-state";

const HEALTH_TIMEOUT_MS = 2500;

type ProbeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; timeout: boolean; status?: number };

function hasRealEnv(name: string) {
  const value = process.env[name];
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.includes("placeholder")) return false;
  if (v === "qa-bots-control-disabled") return false;
  return true;
}

function isMissingTableError(message?: string) {
  const m = String(message ?? "").toLowerCase();
  return (
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("could not find the table") ||
    m.includes("schema cache") ||
    m.includes("table") && m.includes("missing")
  );
}

function getSupabaseHeaders() {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<ProbeResult<{ status: number; body: any }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text || null;
    }

    if (!res.ok) {
      const message =
        typeof body === "object" && body
          ? String(body.message ?? body.error ?? body.hint ?? `${res.status} ${res.statusText}`)
          : `${res.status} ${res.statusText}`;

      return { ok: false, error: message, timeout: false, status: res.status };
    }

    return { ok: true, data: { status: res.status, body } };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `timeout after ${HEALTH_TIMEOUT_MS}ms`, timeout: true };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
      timeout: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  let viewerId: string;
  try {
    viewerId = await requireAdminUserId();
  } catch {
    return failAdmin("/api/admin/health", "No active session", 401, {
      code: "UNAUTHORIZED",
      hint: "Войди в аккаунт и открой /admin повторно",
    });
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: hasRealEnv("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hasRealEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: hasRealEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };

  const issues: string[] = [];
  const steps: string[] = [];

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const headers = getSupabaseHeaders();

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push("ENV missing: NEXT_PUBLIC_SUPABASE_URL");
    steps.push("Проверь NEXT_PUBLIC_SUPABASE_URL в Vercel Production");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    issues.push("ENV missing: NEXT_PUBLIC_SUPABASE_ANON_KEY");
    steps.push("Проверь NEXT_PUBLIC_SUPABASE_ANON_KEY в Vercel Production");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push("ENV missing: SUPABASE_SERVICE_ROLE_KEY");
    steps.push("Проверь SUPABASE_SERVICE_ROLE_KEY в Vercel Production");
    steps.push("Сделай redeploy после обновления переменных окружения");
    const message = "Service role key unavailable";
    setLastHealthError(message);

    return ok({
      ok: false,
      code: "SERVICE_ROLE_UNAVAILABLE",
      mode: "degraded",
      user_id: viewerId,
      env,
      db: { connected: false, error: message },
      checks: {
        service_role_probe: false,
        users_probe: false,
        analytics_table_exists: false,
        analytics_last_event_at: null,
      },
      tables: [
        { name: "users", exists: false, rows_24h: 0, rows_7d: 0, rows_30d: 0, error: "service role unavailable" },
        { name: "analytics_events", exists: false, rows_24h: 0, rows_7d: 0, rows_30d: 0, error: "service role unavailable" },
      ],
      issues,
      steps,
      last_error: getLastHealthError(),
    });
  }

  if (!baseUrl) {
    const message = "Supabase URL unavailable";
    setLastHealthError(message);
    return ok({
      ok: false,
      code: "SUPABASE_URL_UNAVAILABLE",
      mode: "degraded",
      user_id: viewerId,
      env,
      db: { connected: false, error: message },
      checks: {
        service_role_probe: false,
        users_probe: false,
        analytics_table_exists: false,
        analytics_last_event_at: null,
      },
      tables: [
        { name: "users", exists: false, rows_24h: 0, rows_7d: 0, rows_30d: 0, error: message },
        { name: "analytics_events", exists: false, rows_24h: 0, rows_7d: 0, rows_30d: 0, error: message },
      ],
      issues: [...issues, message],
      steps: [...steps, "Добавь NEXT_PUBLIC_SUPABASE_URL и redeploy"],
      last_error: getLastHealthError(),
    });
  }

  const serviceProbe = await fetchWithTimeout(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
    method: "GET",
    headers,
  });

  const usersProbe = await fetchWithTimeout(`${baseUrl}/rest/v1/users?select=id&limit=1`, {
    method: "GET",
    headers,
  });

  const analyticsProbe = await fetchWithTimeout(
    `${baseUrl}/rest/v1/analytics_events?select=created_at&order=created_at.desc&limit=1`,
    {
      method: "GET",
      headers,
    },
  );

  if (!serviceProbe.ok) {
    issues.push(`Service role probe failed: ${serviceProbe.error}`);
    steps.push("Проверь SUPABASE_SERVICE_ROLE_KEY в Vercel Production");
    steps.push("Сделай redeploy");
  }

  if (!usersProbe.ok) {
    if (isMissingTableError(usersProbe.error)) {
      issues.push("Table users missing");
      steps.push("Создай таблицу public.users");
    } else {
      issues.push(`Users probe failed: ${usersProbe.error}`);
      steps.push("Проверь доступ service role к public.users");
    }
  }

  let analyticsExists = true;
  let analyticsLastEventAt: string | null = null;

  if (!analyticsProbe.ok) {
    if (isMissingTableError(analyticsProbe.error)) {
      analyticsExists = false;
      issues.push("Table analytics_events missing");
      steps.push("Создай таблицу public.analytics_events");
    } else {
      analyticsExists = false;
      issues.push(`Analytics probe failed: ${analyticsProbe.error}`);
      steps.push("Проверь доступ service role к public.analytics_events");
    }
  } else {
    const body = Array.isArray(analyticsProbe.data.body) ? analyticsProbe.data.body : [];
    analyticsLastEventAt = body[0]?.created_at ?? null;
  }

  const okState = issues.length === 0;
  const dbError = issues.length ? issues[0] : null;
  setLastHealthError(dbError);

  return ok({
    ok: okState,
    code: okState ? "OK" : serviceProbe.ok ? "HEALTH_DEGRADED" : "SERVICE_ROLE_UNAVAILABLE",
    mode: okState ? "normal" : "degraded",
    user_id: viewerId,
    env,
    db: {
      connected: serviceProbe.ok,
      error: dbError,
    },
    checks: {
      service_role_probe: serviceProbe.ok,
      users_probe: usersProbe.ok,
      analytics_table_exists: analyticsExists,
      analytics_last_event_at: analyticsLastEventAt,
    },
    tables: [
      {
        name: "users",
        exists: usersProbe.ok || !isMissingTableError(usersProbe.ok ? undefined : usersProbe.error),
        rows_24h: 0,
        rows_7d: 0,
        rows_30d: 0,
        ...(usersProbe.ok ? {} : { error: usersProbe.error }),
      },
      {
        name: "analytics_events",
        exists: analyticsExists,
        rows_24h: 0,
        rows_7d: 0,
        rows_30d: 0,
        ...(analyticsProbe.ok ? {} : { error: analyticsProbe.error }),
      },
    ],
    issues,
    steps,
    last_error: getLastHealthError(),
  });
}
