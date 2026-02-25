import { z } from "zod";

export const metricsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
});

export const moderationActionSchema = z.object({
  targetType: z.enum(["user", "post", "event", "comment", "report", "flag"]),
  targetId: z.string().uuid(),
  action: z.enum([
    "mark_safe",
    "remove_content",
    "warn_user",
    "temporary_ban",
    "shadowban",
    "block_user",
    "unblock_user",
    "resolve_report",
  ]),
  reason: z.string().min(2).max(400),
  metadata: z.record(z.unknown()).optional(),
});

export const featureFlagUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  enabled: z.boolean(),
  rollout: z.number().int().min(0).max(100),
  scope: z.string().min(2).max(40).default("global"),
  payload: z.record(z.unknown()).optional(),
});

export const aiInsightsSchema = z.object({
  question: z.string().min(3).max(1600),
  context: z.record(z.unknown()).optional(),
});

export const userSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const overviewResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string(), segment: z.string() }),
  overview: z.object({
    usersTotal: z.number(),
    dau: z.number(),
    wau: z.number(),
    mau: z.number(),
    dauMau: z.number(),
    newUsers1d: z.number(),
    newUsers7d: z.number(),
    telegramVerifiedRate: z.number(),
    registrationCompletedRate: z.number(),
    verifiedUsers: z.number(),
    dailyDuo1d: z.number(),
    dailyDuo7d: z.number(),
    eventJoin1d: z.number(),
    eventJoin7d: z.number(),
    connectClicked: z.number(),
    chatsStarted: z.number(),
    reportsOpen: z.number(),
    flagsOpen: z.number(),
    blockedUsers: z.number(),
  }),
});

export const funnelsResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string(), segment: z.string() }),
  steps: z.array(
    z.object({
      step: z.string(),
      count: z.number(),
      drop: z.number(),
      conversionFromStart: z.number(),
    }),
  ),
});

export const retentionResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string(), segment: z.string() }),
  cohorts: z.array(
    z.object({
      cohortWeek: z.string(),
      cohortSize: z.number(),
      d1Rate: z.number(),
      d7Rate: z.number(),
      d30Rate: z.number(),
    }),
  ),
});

export const userSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string(),
      role: z.string(),
      is_blocked: z.boolean(),
      shadow_banned: z.boolean().optional(),
      blocked_reason: z.string().nullable(),
      blocked_until: z.string().nullable(),
      created_at: z.string(),
      last_post_at: z.string().nullable(),
      telegram_verified: z.boolean().optional(),
      profile_completed: z.boolean().optional(),
      openFlags: z.number(),
      openReports: z.number(),
      lastSeenAt: z.string().nullable(),
    }),
  ),
});

export const moderationQueueResponseSchema = z.object({
  reports: z.array(z.any()).optional(),
  flags: z.array(z.any()).optional(),
  riskyContent: z
    .object({
      posts: z.array(z.any()),
      comments: z.array(z.any()),
      events: z.array(z.any()),
    })
    .optional(),
});

export const featureFlagsResponseSchema = z.object({
  flags: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      description: z.string().nullable(),
      enabled: z.boolean(),
      rollout: z.number(),
      scope: z.string(),
      payload: z.record(z.unknown()),
      updated_at: z.string(),
    }),
  ),
  configs: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      value: z.record(z.unknown()),
      description: z.string().nullable(),
      updated_at: z.string(),
    }),
  ),
});

export const aiInsightsResponseSchema = z.object({
  summary: z.string(),
  anomalies: z.array(z.string()),
  causes: z.array(z.string()),
  actions: z.array(z.string()),
  sql: z.array(z.string()),
  filters: z.array(z.string()),
  riskAlerts: z.array(z.string()),
});
