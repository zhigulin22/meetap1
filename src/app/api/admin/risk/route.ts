import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { buildRiskProfiles } from "@/server/risk";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["super_admin", "admin", "moderator", "analyst"]);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const usersRes = await supabaseAdmin
      .from("users")
      .select("id,name,username,email,phone,country,city,is_demo,demo_group,is_blocked,shadow_banned,message_limited,last_post_at,created_at")
      .order("created_at", { ascending: false })
      .limit(800);

    const users = usersRes.data ?? [];
    const userIds = users.map((u: any) => u.id);

    const [riskMap, lastSeenRes, eventsRes] = await Promise.all([
      buildRiskProfiles(userIds),
      userIds.length
        ? supabaseAdmin
            .from("analytics_events")
            .select("user_id,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
            .limit(20000)
        : Promise.resolve({ data: [] as Array<{ user_id: string; created_at: string }> }),
      userIds.length
        ? supabaseAdmin
            .from("analytics_events")
            .select("user_id,event_name,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
            .limit(30000)
        : Promise.resolve({ data: [] as Array<{ user_id: string; event_name: string; created_at: string }> }),
    ]);

    const lastSeenMap = new Map<string, string>();
    for (const row of lastSeenRes.data ?? []) {
      if (!row.user_id) continue;
      if (!lastSeenMap.has(row.user_id)) lastSeenMap.set(row.user_id, row.created_at);
    }

    const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const violations7d = new Map<string, number>();
    for (const row of eventsRes.data ?? []) {
      if (!row.user_id) continue;
      if (new Date(row.created_at).getTime() < since7d) continue;
      const ev = String(row.event_name || "").toLowerCase();
      if (ev.includes("report") || ev.includes("flag") || ev.includes("ban") || ev.includes("limit") || ev.includes("blocked")) {
        violations7d.set(row.user_id, (violations7d.get(row.user_id) ?? 0) + 1);
      }
    }

    let items = users
      .map((u: any) => {
        const risk = riskMap.get(u.id) ?? { riskScore: 0, riskStatus: "low", signals: [] };
        return {
          ...u,
          risk_score: risk.riskScore,
          risk_status: risk.riskStatus,
          signals: risk.signals.map((s: any) => `${s.label}: ${s.value}`),
          top_signals: risk.signals,
          last_seen_at: lastSeenMap.get(u.id) ?? null,
          violations_7d: violations7d.get(u.id) ?? 0,
        };
      })
      .filter((x: any) => x.risk_score > 0 || x.is_blocked || x.shadow_banned || x.message_limited);

    if (q) {
      items = items.filter((x: any) => {
        const bucket = `${x.id} ${x.name ?? ""} ${x.username ?? ""} ${x.email ?? ""} ${x.phone ?? ""}`.toLowerCase();
        return bucket.includes(q);
      });
    }

    items = items.sort((a: any, b: any) => b.risk_score - a.risk_score).slice(0, 400);

    const distribution = {
      low: items.filter((x: any) => x.risk_status === "low").length,
      medium: items.filter((x: any) => x.risk_status === "medium").length,
      high: items.filter((x: any) => x.risk_status === "high").length,
    };

    const topSignalsMap = new Map<string, number>();
    for (const item of items) {
      for (const sig of item.top_signals ?? []) {
        topSignalsMap.set(sig.key, (topSignalsMap.get(sig.key) ?? 0) + 1);
      }
    }

    const topSignals = [...topSignalsMap.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 8);

    return ok({ items, distribution, topSignals });
  } catch {
    return fail("Forbidden", 403);
  }
}
