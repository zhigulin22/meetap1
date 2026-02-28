import { failAdmin, ok } from "@/lib/http";
import { AdminAccessError, requireAdminUserId } from "@/server/admin";
import { requireUserId } from "@/server/auth";
import { getLastHealthError } from "@/server/admin-health-state";

const TIMEOUT_MS = 2500;

function maskSupabaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.host;
    const prefix = host.slice(0, 6);
    const suffix = host.slice(-6);
    return `${u.protocol}//${prefix}***${suffix}`;
  } catch {
    if (value.length < 10) return "***";
    return `${value.slice(0, 6)}***${value.slice(-4)}`;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
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
      return { ok: false as const, error: message, status: res.status };
    }

    return { ok: true as const, status: res.status };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false as const, error: `timeout after ${TIMEOUT_MS}ms` };
    }
    return { ok: false as const, error: error instanceof Error ? error.message : "unknown error" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    requireUserId();
  } catch {
    return failAdmin("/api/admin/health/debug", "No active session", 401, {
      code: "UNAUTHORIZED",
      hint: "Войди в аккаунт и открой /admin повторно",
    });
  }

  try {
    await requireAdminUserId(["admin"]);
  } catch (error) {
    if (!(error instanceof AdminAccessError) || error.code !== "MISSING_ENV") {
      return failAdmin("/api/admin/health/debug", "Forbidden", 403, {
        code: "FORBIDDEN",
        hint: "Только admin может открывать debug endpoint",
      });
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceRoleToken = serviceRole ?? "";
  const serviceRolePresent = Boolean(serviceRoleToken);

  const probe = baseUrl && serviceRolePresent
    ? await fetchWithTimeout(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
        method: "GET",
        headers: {
          apikey: serviceRoleToken,
          Authorization: `Bearer ${serviceRoleToken}`,
        },
      })
    : { ok: false as const, error: !baseUrl ? "supabase url missing" : "service role key missing" };

  return ok({
    ok: true,
    masked_supabase_url: maskSupabaseUrl(baseUrl),
    service_role_present: serviceRolePresent,
    service_role_probe_ok: probe.ok,
    last_error_message: getLastHealthError(),
    probe_error: probe.ok ? null : probe.error,
  });
}
