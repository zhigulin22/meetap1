import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

async function countEvent(name: string, sinceISO: string) {
  const { count } = await supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", name).gte("created_at", sinceISO);
  return count ?? 0;
}

export async function POST() {
  try {
    await requireAdminUserId();

    const { data: alerts } = await supabaseAdmin.from("alerts").select("*").eq("status", "active");
    const triggered: Array<Record<string, unknown>> = [];

    for (const alert of alerts ?? []) {
      const windowDays = Number((alert as any).alert_window ?? 7);
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      let value = 0;

      if (alert.metric === "dau") value = await countEvent("message_sent", since);
      if (alert.metric === "tg_verify_rate") {
        const s = await countEvent("register_started", since);
        const v = await countEvent("telegram_verified", since);
        value = s > 0 ? Number((v / s).toFixed(3)) : 0;
      }
      if (alert.metric === "registration_rate") {
        const s = await countEvent("register_started", since);
        const v = await countEvent("registration_completed", since);
        value = s > 0 ? Number((v / s).toFixed(3)) : 0;
      }
      if (alert.metric === "api_errors") value = await countEvent("api_error", since);
      if (alert.metric === "ai_cost") {
        const { data } = await supabaseAdmin.from("analytics_events").select("properties").eq("event_name", "ai_cost").gte("created_at", since).limit(5000);
        value = (data ?? []).reduce((sum: number, row: any) => sum + Number(row.properties?.usd ?? 0), 0);
      }

      if (value >= Number(alert.threshold)) {
        triggered.push({ id: alert.id, metric: alert.metric, value, threshold: alert.threshold });
        await supabaseAdmin.from("alerts").update({ status: "triggered", last_triggered_at: new Date().toISOString() }).eq("id", alert.id);
        try {
          await supabaseAdmin.from("alert_triggers").insert({ alert_id: alert.id, metric: alert.metric, value, threshold: alert.threshold, details: { source: "manual-check" } });
        } catch {
          // ignore if table is not migrated yet
        }
      }
    }

    const keyEvents = ["register_started", "telegram_verified", "registration_completed", "post_published_daily_duo", "event_joined"];
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const missing: string[] = [];
    for (const name of keyEvents) {
      const c = await countEvent(name, sinceDay);
      if (c === 0) missing.push(name);
    }

    return ok({ triggered, dataMissingEvents24h: missing });
  } catch {
    return fail("Forbidden", 403);
  }
}
