import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();

    const [users, flags, reports] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,phone,is_blocked,shadow_banned,blocked_reason,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("content_flags")
        .select("user_id,risk_score,status,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("reports")
        .select("target_user_id,status,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const riskMap = new Map<string, { score: number; signals: string[] }>();

    for (const f of flags.data ?? []) {
      if (!f.user_id) continue;
      const row = riskMap.get(f.user_id) ?? { score: 0, signals: [] };
      row.score += Math.max(5, Math.floor((f.risk_score ?? 0) / 5));
      if (row.signals.length < 6) row.signals.push(`flag: ${f.reason}`);
      riskMap.set(f.user_id, row);
    }

    for (const r of reports.data ?? []) {
      if (!r.target_user_id) continue;
      const row = riskMap.get(r.target_user_id) ?? { score: 0, signals: [] };
      row.score += r.status === "open" ? 20 : 8;
      if (row.signals.length < 6) row.signals.push(`report: ${r.reason}`);
      riskMap.set(r.target_user_id, row);
    }

    const items = (users.data ?? [])
      .map((u) => {
        const risk = riskMap.get(u.id) ?? { score: 0, signals: [] };
        const status = risk.score >= 80 ? "high" : risk.score >= 45 ? "medium" : "low";
        return {
          ...u,
          risk_score: Math.min(100, risk.score),
          risk_status: status,
          signals: risk.signals,
        };
      })
      .filter((x) => x.risk_score > 0 || x.is_blocked || x.shadow_banned)
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 200);

    return ok({ items });
  } catch {
    return fail("Forbidden", 403);
  }
}
