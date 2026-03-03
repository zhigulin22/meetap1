import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

type TrafficStatusPayload = {
  run: Record<string, any> | null;
  runtime_status: "STOPPED" | "STARTING" | "RUNNING" | "DEGRADED";
  total_events: number;
  events_last_2m: number;
  last_event_at: string | null;
  sample_events: Array<{ event_name: string; created_at: string; user_id: string | null }>;
  stale?: boolean;
};

const querySchema = z.object({
  run_id: z.string().uuid().optional(),
});

const CACHE_TTL_MS = 2_000;

type CacheEntry = {
  key: string;
  etag: string;
  expiresAt: number;
  payload: TrafficStatusPayload;
};

let statusCache: CacheEntry | null = null;

function etagFromPayload(payload: TrafficStatusPayload) {
  const digest = createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  return `W/\"traffic-status-${digest}\"`;
}

function statusHeaders(etag: string, cacheHit: boolean, stale = false) {
  return {
    ETag: etag,
    "Cache-Control": "private, max-age=1, stale-while-revalidate=2",
    "X-Traffic-Status-Cache": cacheHit ? "HIT" : "MISS",
    "X-Traffic-Status-Stale": stale ? "1" : "0",
  };
}

function runtimeStatus(run: any, lastEventAt: string | null): TrafficStatusPayload["runtime_status"] {
  if (!run) return "STOPPED";
  if (String(run.status ?? "").toLowerCase() !== "running") return "STOPPED";
  if (!lastEventAt) return "STARTING";

  const ageMs = Date.now() - new Date(lastEventAt).getTime();
  if (ageMs <= 90_000) return "RUNNING";
  if (ageMs <= 5 * 60_000) return "DEGRADED";
  return "STARTING";
}

function payloadFrom(run: any, lastEventRow: any): TrafficStatusPayload {
  const lastEventAt = lastEventRow?.created_at ?? null;
  return {
    run: run ?? null,
    runtime_status: runtimeStatus(run, lastEventAt),
    total_events: Number(run?.total_events_generated ?? run?.events_written_total ?? 0),
    events_last_2m: 0,
    last_event_at: lastEventAt,
    sample_events: lastEventRow
      ? [
          {
            event_name: String(lastEventRow.event_name ?? "unknown"),
            created_at: String(lastEventRow.created_at ?? ""),
            user_id: typeof lastEventRow.user_id === "string" ? lastEventRow.user_id : null,
          },
        ]
      : [],
  };
}

async function loadStatus(runId: string | null) {
  let runQuery = supabaseAdmin
    .from("traffic_runs")
    .select("id,status,users_count,interval_sec,intensity,chaos,started_at,updated_at,stopped_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (runId) {
    runQuery = supabaseAdmin
      .from("traffic_runs")
      .select("id,status,users_count,interval_sec,intensity,chaos,started_at,updated_at,stopped_at")
      .eq("id", runId)
      .limit(1);
  }

  const [runRes, lastEventRes] = await Promise.all([
    runQuery.maybeSingle(),
    supabaseAdmin
      .from("analytics_events")
      .select("created_at,event_name,user_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (runRes.error) throw new Error(runRes.error.message);
  if (lastEventRes.error) throw new Error(lastEventRes.error.message);

  return payloadFrom(runRes.data ?? null, lastEventRes.data ?? null);
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({ run_id: searchParams.get("run_id") ?? undefined });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422, {
        endpoint: "/api/admin/traffic/status",
        code: "VALIDATION",
      });
    }

    const runId = parsed.data.run_id ?? null;
    const cacheKey = runId ?? "latest";
    const ifNoneMatch = req.headers.get("if-none-match");

    if (statusCache && statusCache.key === cacheKey && statusCache.expiresAt > Date.now()) {
      if (ifNoneMatch && ifNoneMatch === statusCache.etag) {
        return new NextResponse(null, { status: 304, headers: statusHeaders(statusCache.etag, true, false) });
      }
      return NextResponse.json(statusCache.payload, { headers: statusHeaders(statusCache.etag, true, false) });
    }

    try {
      const payload = await loadStatus(runId);
      const etag = etagFromPayload(payload);
      statusCache = {
        key: cacheKey,
        etag,
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      };

      if (ifNoneMatch && ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers: statusHeaders(etag, false, false) });
      }

      return NextResponse.json(payload, { headers: statusHeaders(etag, false, false) });
    } catch (dbError) {
      if (statusCache && statusCache.key === cacheKey) {
        const stalePayload = { ...statusCache.payload, stale: true };
        return NextResponse.json(stalePayload, { headers: statusHeaders(statusCache.etag, true, true) });
      }
      throw dbError;
    }
  } catch (error) {
    return adminRouteError("/api/admin/traffic/status", error);
  }
}
