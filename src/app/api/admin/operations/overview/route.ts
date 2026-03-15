import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

function pct(n: number, d: number) {
  if (!d) return 0;
  return Number((n / d).toFixed(4));
}

export async function GET() {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst", "support"]);

    const now = Date.now();
    const d5m = new Date(now - 5 * 60 * 1000).toISOString();
    const d15m = new Date(now - 15 * 60 * 1000).toISOString();
    const d1h = new Date(now - 60 * 60 * 1000).toISOString();
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const [
      events5m,
      lastEvent,
      regStarted,
      tgVerified,
      aiReq,
      aiErr,
      aiCostRows,
      reports1h,
      riskyUsers,
      latRows,
      activeAlerts,
      incidents,
      trafficRun,
    ] = await Promise.all([
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", d5m),
      supabaseAdmin.from("analytics_events").select("created_at").order("created_at", { ascending: false }).limit(1),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", ["auth.register_started", "register_started"]).gte("created_at", d15m),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", ["auth.telegram_verified", "telegram_verified"]).gte("created_at", d15m),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", ["ai_request", "ai.request"]).gte("created_at", d15m),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", ["ai_error", "ai_request_fail"]).gte("created_at", d15m),
      supabaseAdmin.from("analytics_events").select("properties").in("event_name", ["ai_cost", "ai_request_cost"]).gte("created_at", dayStart).limit(10000),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).in("event_name", ["safety.report_created", "report_created"]).gte("created_at", d1h),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).or("is_blocked.eq.true,shadow_banned.eq.true,message_limited.eq.true"),
      supabaseAdmin.from("analytics_events").select("properties").eq("event_name", "api_latency_ms").gte("created_at", d1h).limit(6000),
      supabaseAdmin.from("alerts").select("id,type,metric,status,updated_at,threshold").in("status", ["active", "triggered"]).order("updated_at", { ascending: false }).limit(20),
      supabaseAdmin.from("admin_audit_log").select("id,action,target_type,target_id,created_at,admin_id,meta").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("traffic_runs").select("id,status,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const aiCostToday = (aiCostRows.data ?? []).reduce((acc: number, row: any) => acc + Number(row?.properties?.usd ?? row?.properties?.cost_usd ?? 0), 0);

    const latencies = (latRows.data ?? [])
      .map((x: any) => Number(x?.properties?.ms ?? x?.properties?.latency_ms ?? 0))
      .filter((x: number) => Number.isFinite(x) && x > 0)
      .sort((a: number, b: number) => a - b);

    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1] : 0;

    return ok({
      status_strip: {
        events_last_5min: events5m.count ?? 0,
        last_event_at: lastEvent.data?.[0]?.created_at ?? null,
        tg_verify_success_rate_15min: pct(tgVerified.count ?? 0, Math.max(1, regStarted.count ?? 0)),
        tg_verify_started_15min: regStarted.count ?? 0,
        tg_verify_completed_15min: tgVerified.count ?? 0,
        ai_requests_15min: aiReq.count ?? 0,
        ai_error_rate_15min: pct(aiErr.count ?? 0, Math.max(1, aiReq.count ?? 0)),
        ai_cost_today: Number(aiCostToday.toFixed(4)),
        reports_1h: reports1h.count ?? 0,
        risk_high_count: riskyUsers.count ?? 0,
        api_latency_p95_1h: Number(p95.toFixed(2)),
      },
      active_alerts: activeAlerts.data ?? [],
      incident_timeline: incidents.data ?? [],
      quick_actions: {
        traffic_running: trafficRun.data?.status === "running",
        can_export_snapshot: true,
      },
      warnings: [
        ...(events5m.count === 0 ? ["За последние 5 минут нет событий analytics"] : []),
        ...(lastEvent.data?.[0]?.created_at ? [] : ["Не найдено ни одного события"]),
      ],
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
