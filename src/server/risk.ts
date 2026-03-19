import { supabaseAdmin } from "@/supabase/admin";
import { aliasesForCanonicals, canonicalizeEventName } from "@/server/event-dictionary";

export type RiskSignal = {
  key: string;
  label: string;
  value: number;
  severity: number;
  evidence: Record<string, unknown>;
};

export type RiskProfile = {
  userId: string;
  riskScore: number;
  riskStatus: "low" | "medium" | "high";
  signals: RiskSignal[];
};

function statusFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function daysBackISO(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function sumSeverity(signals: RiskSignal[]) {
  const total = signals.reduce((acc, s) => acc + Math.max(1, s.severity) * 12, 0);
  return Math.min(100, total);
}

export async function buildRiskProfiles(userIds: string[], fromISO?: string, toISO?: string) {
  if (!userIds.length) return new Map<string, RiskProfile>();

  const from = fromISO ?? daysBackISO(7);
  const to = toISO ?? new Date().toISOString();

  const [eventsRes, reportsRes, flagsRes, signalsRes] = await Promise.all([
    supabaseAdmin
      .from("analytics_events")
      .select("user_id,event_name,properties,created_at")
      .in("user_id", userIds)
      .in("event_name", aliasesForCanonicals(["connect_sent", "connect_replied", "message_sent", "report_created"])) 
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(120000),
    supabaseAdmin
      .from("reports")
      .select("target_user_id,created_at,status")
      .in("target_user_id", userIds)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(20000),
    supabaseAdmin
      .from("content_flags")
      .select("user_id,risk_score,status,reason,created_at")
      .in("user_id", userIds)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(20000),
    supabaseAdmin
      .from("risk_signals")
      .select("user_id,signal_key,value,severity,evidence,created_at")
      .in("user_id", userIds)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(20000),
  ]);

  const events = eventsRes.data ?? [];
  const reports = reportsRes.data ?? [];
  const flags = flagsRes.data ?? [];
  const persistedSignals = signalsRes.data ?? [];

  const byUser = new Map<string, {
    connectSent: number;
    connectReplied: number;
    dailyConnectSent: Map<string, number>;
    dailyEvents: Map<string, number>;
    hashCounts: Map<string, number>;
    reportsReceived: number;
    openReports: number;
    flagsHigh: number;
    flagsOpen: number;
    signals: RiskSignal[];
  }>();

  for (const id of userIds) {
    byUser.set(id, {
      connectSent: 0,
      connectReplied: 0,
      dailyConnectSent: new Map(),
      dailyEvents: new Map(),
      hashCounts: new Map(),
      reportsReceived: 0,
      openReports: 0,
      flagsHigh: 0,
      flagsOpen: 0,
      signals: [],
    });
  }

  for (const row of events) {
    if (!row.user_id) continue;
    const s = byUser.get(row.user_id);
    if (!s) continue;

    const day = row.created_at.slice(0, 10);
    s.dailyEvents.set(day, (s.dailyEvents.get(day) ?? 0) + 1);

    const canonical = canonicalizeEventName(row.event_name);
    if (canonical === "connect_sent") {
      s.connectSent += 1;
      s.dailyConnectSent.set(day, (s.dailyConnectSent.get(day) ?? 0) + 1);
    }
    if (canonical === "connect_replied") s.connectReplied += 1;

    const hash = String((row.properties as Record<string, unknown> | null)?.message_hash ?? "");
    if (hash && hash !== "undefined" && hash !== "null") {
      s.hashCounts.set(hash, (s.hashCounts.get(hash) ?? 0) + 1);
    }
  }

  for (const row of reports) {
    if (!row.target_user_id) continue;
    const s = byUser.get(row.target_user_id);
    if (!s) continue;
    s.reportsReceived += 1;
    if (row.status === "open") s.openReports += 1;
  }

  for (const row of flags) {
    if (!row.user_id) continue;
    const s = byUser.get(row.user_id);
    if (!s) continue;
    if ((row.risk_score ?? 0) >= 80) s.flagsHigh += 1;
    if (row.status === "open") s.flagsOpen += 1;
  }

  for (const row of persistedSignals) {
    const s = byUser.get(row.user_id);
    if (!s) continue;
    s.signals.push({
      key: row.signal_key,
      label: row.signal_key,
      value: Number(row.value ?? 0),
      severity: Number(row.severity ?? 1),
      evidence: (row.evidence as Record<string, unknown> | null) ?? {},
    });
  }

  const out = new Map<string, RiskProfile>();

  for (const [userId, s] of byUser.entries()) {
    const signals: RiskSignal[] = [...s.signals];

    const maxConnectSentDay = Math.max(0, ...s.dailyConnectSent.values());
    if (maxConnectSentDay > 60) {
      signals.push({
        key: "connect_sent_burst_high",
        label: "Всплеск connect_sent/day > 60",
        value: maxConnectSentDay,
        severity: 5,
        evidence: { threshold: 60 },
      });
    } else if (maxConnectSentDay > 30) {
      signals.push({
        key: "connect_sent_burst",
        label: "Всплеск connect_sent/day > 30",
        value: maxConnectSentDay,
        severity: 4,
        evidence: { threshold: 30 },
      });
    }

    const replyRate = s.connectSent > 0 ? s.connectReplied / s.connectSent : 1;
    if (s.connectSent > 20 && replyRate < 0.05) {
      signals.push({
        key: "low_reply_rate",
        label: "Низкий reply rate при высоком connect_sent",
        value: Number(replyRate.toFixed(3)),
        severity: 4,
        evidence: { connect_sent: s.connectSent, connect_replied: s.connectReplied },
      });
    }

    const repeatedHashes = Math.max(0, ...s.hashCounts.values());
    if (repeatedHashes > 10) {
      signals.push({
        key: "repeated_message_hashes",
        label: "Повторяющиеся message_hash",
        value: repeatedHashes,
        severity: 3,
        evidence: { threshold: 10 },
      });
    }

    if (s.reportsReceived > 7) {
      signals.push({
        key: "reports_received_critical",
        label: "Много жалоб за 7д",
        value: s.reportsReceived,
        severity: 5,
        evidence: { window_days: 7, open_reports: s.openReports },
      });
    } else if (s.reportsReceived > 3) {
      signals.push({
        key: "reports_received",
        label: "Жалобы за 7д",
        value: s.reportsReceived,
        severity: 3,
        evidence: { window_days: 7, open_reports: s.openReports },
      });
    }

    if (s.flagsHigh > 0 || s.flagsOpen > 0) {
      signals.push({
        key: "content_flags",
        label: "Контент-флаги",
        value: s.flagsOpen + s.flagsHigh,
        severity: s.flagsHigh > 0 ? 4 : 2,
        evidence: { flags_high: s.flagsHigh, flags_open: s.flagsOpen },
      });
    }

    const daily = [...s.dailyEvents.entries()].sort((a: any, b: any) => a[0].localeCompare(b[0]));
    if (daily.length >= 3) {
      const last = daily[daily.length - 1]?.[1] ?? 0;
      const prevVals = daily.slice(0, -1).map((x: any) => x[1]);
      const avg = prevVals.reduce((acc, v) => acc + v, 0) / Math.max(1, prevVals.length);
      if (last >= 40 && last > avg * 3) {
        signals.push({
          key: "sudden_activity_spike",
          label: "Резкий всплеск активности",
          value: Number((last / Math.max(1, avg)).toFixed(2)),
          severity: 3,
          evidence: { last_day_events: last, avg_prev_days: Number(avg.toFixed(2)) },
        });
      }
    }

    const dedup = new Map<string, RiskSignal>();
    for (const sig of signals) {
      const cur = dedup.get(sig.key);
      if (!cur || sig.severity >= cur.severity) dedup.set(sig.key, sig);
    }

    const finalSignals = [...dedup.values()].sort((a: any, b: any) => b.severity - a.severity || b.value - a.value).slice(0, 8);
    const riskScore = sumSeverity(finalSignals);

    out.set(userId, {
      userId,
      riskScore,
      riskStatus: statusFromScore(riskScore),
      signals: finalSignals,
    });
  }

  return out;
}

export async function buildSingleUserRisk(userId: string) {
  const map = await buildRiskProfiles([userId]);
  return map.get(userId) ?? { userId, riskScore: 0, riskStatus: "low" as const, signals: [] };
}
