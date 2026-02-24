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
];

export function detectRiskText(content: string) {
  const matched = bannedPatterns.filter((p) => p.test(content));
  return {
    risky: matched.length > 0,
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
