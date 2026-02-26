import { supabaseAdmin } from "@/supabase/admin";

export async function trackEvent(input: {
  eventName: string;
  userId?: string | null;
  path?: string | null;
  properties?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("analytics_events").insert({
      event_name: input.eventName,
      user_id: input.userId ?? null,
      path: input.path ?? null,
      properties: input.properties ?? {},
    });
  } catch {
    // ignore analytics errors
  }
}

const bannedPatterns = [
  /террор/i,
  /взрыв/i,
  /оруж/i,
  /наркот/i,
  /закладк/i,
  /доз[аы]/i,
  /героин/i,
  /кокаин/i,
  /амфетамин/i,
  /куплю\s*документы/i,
  /мошен/i,
  /scam/i,
  /nsfw/i,
];

export function detectRiskText(content: string) {
  const matched = bannedPatterns.filter((p) => p.test(content));

  const scoreBase = matched.length * 24;
  const longAggressive = content.length > 260 ? 10 : 0;
  const score = Math.min(100, scoreBase + longAggressive);

  let status: "clean" | "limited" | "soft_hidden" | "removed" = "clean";
  if (score >= 80) status = "soft_hidden";
  else if (score >= 50) status = "limited";

  return {
    risky: score >= 50,
    score,
    status,
    patterns: matched.map((x) => x.source),
  };
}

export async function createRiskFlag(input: {
  userId: string;
  source: string;
  reason: string;
  evidence?: string;
  severity?: "low" | "medium" | "high";
}) {
  try {
    await supabaseAdmin.from("user_flags").insert({
      user_id: input.userId,
      source: input.source,
      reason: input.reason,
      evidence: input.evidence ?? null,
      severity: input.severity ?? "medium",
      status: "open",
    });
  } catch {
    // no-op
  }
}

export async function createContentFlag(input: {
  contentType: "post" | "event" | "comment" | "profile";
  contentId: string;
  userId?: string | null;
  source: "ai" | "user_report" | "rules";
  reason: string;
  riskScore: number;
  aiExplanation?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("content_flags").insert({
      content_type: input.contentType,
      content_id: input.contentId,
      user_id: input.userId ?? null,
      source: input.source,
      reason: input.reason,
      risk_score: input.riskScore,
      status: "open",
      ai_explanation: input.aiExplanation ?? null,
      metadata: input.metadata ?? {},
    });

    await trackEvent({
      eventName: "flag_created",
      userId: input.userId ?? null,
      path: "/moderation",
      properties: { contentType: input.contentType, source: input.source, riskScore: input.riskScore },
    });
  } catch {
    // no-op
  }
}

export async function applyContentModeration(input: {
  contentType: "post" | "event" | "comment";
  contentId: string;
  score: number;
  status: "clean" | "limited" | "soft_hidden" | "removed";
}) {
  try {
    const table = input.contentType === "post" ? "posts" : input.contentType === "event" ? "events" : "comments";
    const patch: Record<string, unknown> = {
      risk_score: input.score,
      moderation_status: input.status,
    };

    if (input.status === "removed") {
      patch.removed_at = new Date().toISOString();
    }

    await (supabaseAdmin as any).from(table).update(patch).eq("id", input.contentId);
  } catch {
    // no-op
  }
}

export async function addReport(input: {
  reporterUserId?: string | null;
  targetUserId?: string | null;
  contentType: "post" | "event" | "comment" | "profile";
  contentId?: string | null;
  reason: string;
  details?: string;
}) {
  try {
    await supabaseAdmin.from("reports").insert({
      reporter_user_id: input.reporterUserId ?? null,
      target_user_id: input.targetUserId ?? null,
      content_type: input.contentType,
      content_id: input.contentId ?? null,
      reason: input.reason,
      details: input.details ?? null,
      status: "open",
    });
  } catch {
    // no-op
  }
}
