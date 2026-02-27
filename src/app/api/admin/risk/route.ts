import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { buildRiskProfiles } from "@/server/risk";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();

    const usersRes = await supabaseAdmin
      .from("users")
      .select("id,name,phone,country,is_blocked,shadow_banned,message_limited,last_post_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const users = usersRes.data ?? [];
    const userIds = users.map((u: any) => u.id);

    const [riskMap, lastSeenRes] = await Promise.all([
      buildRiskProfiles(userIds),
      userIds.length
        ? supabaseAdmin
            .from("analytics_events")
            .select("user_id,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
            .limit(15000)
        : Promise.resolve({ data: [] as Array<{ user_id: string; created_at: string }> }),
    ]);

    const lastSeenMap = new Map<string, string>();
    for (const row of lastSeenRes.data ?? []) {
      if (!row.user_id) continue;
      if (!lastSeenMap.has(row.user_id)) lastSeenMap.set(row.user_id, row.created_at);
    }

    const items = users
      .map((u: any) => {
        const risk = riskMap.get(u.id) ?? { riskScore: 0, riskStatus: "low", signals: [] };
        return {
          ...u,
          risk_score: risk.riskScore,
          risk_status: risk.riskStatus,
          signals: risk.signals.map((s: any) => `${s.label}: ${s.value}`),
          top_signals: risk.signals,
          last_seen_at: lastSeenMap.get(u.id) ?? null,
        };
      })
      .filter((x: any) => x.risk_score > 0 || x.is_blocked || x.shadow_banned || x.message_limited)
      .sort((a: any, b: any) => b.risk_score - a.risk_score)
      .slice(0, 300);

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
