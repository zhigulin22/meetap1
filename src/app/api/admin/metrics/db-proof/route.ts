import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { getDevtoolsStatus } from "@/server/simulation";
import { hasServiceRoleKey, adminError } from "@/server/admin-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMinutes(url: string) {
  const raw = new URL(url).searchParams.get("minutes");
  const minutes = Number(raw ?? 2);
  if (!Number.isFinite(minutes)) return 2;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}

async function canAnonReadAnalytics() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { ok: false, reason: "anon env missing" };

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const probe = await anon.from("analytics_events").select("id", { count: "exact", head: true }).limit(1);
  if (probe.error) return { ok: false, reason: probe.error.message };
  return { ok: true, reason: "ok" };
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin"]);

    const minutes = parseMinutes(req.url);
    const sinceWindow = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    if (!hasServiceRoleKey()) {
      return adminError(
        500,
        "SERVICE_ROLE_MISSING",
        "SUPABASE_SERVICE_ROLE_KEY is missing",
        "Добавь корректный SUPABASE_SERVICE_ROLE_KEY в env и redeploy.",
      );
    }

    const [countWindow, lastEvent, devtools, anonRlsProbe] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceWindow)
        .filter("properties->>source", "eq", "live_sim"),
      supabaseAdmin
        .from("analytics_events")
        .select("created_at,event_name")
        .filter("properties->>source", "eq", "live_sim")
        .order("created_at", { ascending: false })
        .limit(1),
      getDevtoolsStatus(),
      canAnonReadAnalytics(),
    ]);

    if (countWindow.error) {
      return adminError(
        500,
        "DB_PROOF_QUERY_FAILED",
        countWindow.error.message,
        "Открой Diagnostics: возможно отсутствует таблица analytics_events или нет прав.",
      );
    }

    if (lastEvent.error) {
      return adminError(
        500,
        "DB_PROOF_LAST_EVENT_FAILED",
        lastEvent.error.message,
        "Открой Diagnostics и проверь таблицу analytics_events.",
      );
    }

    const eventsLastWindow = countWindow.count ?? 0;
    const last = lastEvent.data?.[0] ?? null;

    const reasons: string[] = [];
    if (eventsLastWindow === 0) {
      reasons.push("no_live_sim_events_in_window");
      if (!devtools.enabled) reasons.push("devtools_disabled");
      if (!anonRlsProbe.ok) reasons.push("rls_blocked_for_anon_read");
      if (!hasServiceRoleKey()) reasons.push("service_role_missing");
    }

    return NextResponse.json({
      ok: true,
      minutes,
      events_last_window: eventsLastWindow,
      last_event_at: last?.created_at ?? null,
      last_event_name: last?.event_name ?? null,
      reasons,
      events_last_2m: minutes === 2 ? eventsLastWindow : undefined,
      last_db_event_at: last?.created_at ?? null,
      reason: reasons[0] ?? null,
      has_db_writes: eventsLastWindow > 0,
      status: eventsLastWindow > 0 ? "ok" : "error",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message === "Forbidden") {
      return adminError(403, "FORBIDDEN", message, "Доступ только для admin role.", error);
    }

    return adminError(500, "DB_PROOF_UNKNOWN", message, "Открой Diagnostics и проверь backend ошибки.", error);
  }
}
