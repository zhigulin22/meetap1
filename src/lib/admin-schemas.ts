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
  debug: z.boolean().optional().default(false),
});

export const userSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const trendPointSchema = z.object({
  date: z.string(),
  value: z.number(),
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
    profileCompletionRate: z.number().optional().default(0),
    verifiedUsers: z.number(),
    dailyDuo1d: z.number(),
    dailyDuo7d: z.number(),
    videoPosts1d: z.number(),
    videoPosts7d: z.number(),
    eventJoin1d: z.number(),
    eventJoin7d: z.number(),
    connectClicked: z.number(),
    chatsStarted: z.number(),
    wmc: z.number(),
    reportsOpen: z.number(),
    flagsOpen: z.number(),
    blockedUsers: z.number(),
    apiErrors1d: z.number(),
    aiCalls7d: z.number(),
    aiCostUsd7d: z.number(),
    offlineConversion: z.number().optional().default(0),
    matchesStarted: z.number().optional().default(0),
    continuedD1: z.number().optional().default(0),
  }),
  comparisons: z
    .object({
      registerStartedDiff: z.number(),
      registrationDiff: z.number(),
      connectDiff: z.number(),
      wmcDiff: z.number(),
    })
    .optional(),
  trends: z
    .object({
      dau: z.array(trendPointSchema),
      posts: z.array(trendPointSchema),
      connectReplied: z.array(trendPointSchema),
    })
    .optional(),
  miniFunnel: z
    .array(
      z.object({
        step: z.string(),
        count: z.number(),
        conversion: z.number(),
      }),
    )
    .optional(),
  health: z
    .object({
      p95Latency: z.number(),
      integrations: z.object({
        telegramConfigured: z.boolean(),
        openAiConfigured: z.boolean(),
        supabaseConfigured: z.boolean(),
        integrationErrors7d: z.number(),
      }),
      lastAdminActions: z.array(z.any()),
    })
    .optional(),
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
      phone: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      role: z.string(),
      is_demo: z.boolean().optional(),
      is_blocked: z.boolean(),
      shadow_banned: z.boolean().optional(),
      message_limited: z.boolean().optional(),
      blocked_reason: z.string().nullable(),
      blocked_until: z.string().nullable(),
      created_at: z.string(),
      last_post_at: z.string().nullable(),
      telegram_verified: z.boolean().optional(),
      profile_completed: z.boolean().optional(),
      openFlags: z.number(),
      openReports: z.number(),
      lastSeenAt: z.string().nullable(),
      posts_30d: z.number().optional(),
      joins_30d: z.number().optional(),
      connects_sent_30d: z.number().optional(),
      reply_rate: z.number().optional(),
      risk_score: z.number().optional(),
      status: z.string().optional(),
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
  key_findings: z.array(z.string()),
  evidence: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  actions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["create_alert", "create_experiment", "update_flag"]),
        label: z.string(),
        payload: z.record(z.unknown()),
      }),
    )
    .default([]),
  debug: z
    .object({
      used_fallback: z.boolean(),
      context: z.record(z.unknown()).optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export const diagnosticsResponseSchema = z.object({
  env: z.object({
    SUPABASE_URL: z.boolean(),
    SUPABASE_ANON_KEY: z.boolean(),
    SUPABASE_SERVICE_ROLE: z.boolean(),
    OPENAI_API_KEY: z.boolean(),
    SEED_MINIMAL_ENABLED: z.boolean(),
  }),
  env_present: z
    .object({
      SUPABASE_URL: z.boolean(),
      SUPABASE_ANON_KEY: z.boolean(),
      SUPABASE_SERVICE_ROLE: z.boolean(),
      OPENAI_API_KEY: z.boolean(),
      SEED_MINIMAL_ENABLED: z.boolean(),
    })
    .optional(),
  supabase_ok: z.boolean(),
  tables: z.array(
    z.object({
      name: z.string(),
      exists: z.boolean(),
      rows_24h: z.number(),
      rows_7d: z.number(),
      rows_30d: z.number(),
    }),
  ),
  rls: z.union([
    z.array(
      z.object({
        table: z.string(),
        can_select: z.boolean(),
        note: z.string(),
      }),
    ),
    z.object({
      ok: z.boolean(),
      issues: z.array(z.string()),
      details: z.array(
        z.object({
          table: z.string(),
          can_select: z.boolean(),
          note: z.string(),
        }),
      ),
    }),
  ]),
  last_event_at: z.string().nullable(),
  top_event_names: z.array(
    z.object({
      event_name: z.string(),
      count_24h: z.number(),
    }),
  ).optional(),
  metrics_endpoints: z
    .object({
      series_ok: z.boolean(),
      sample_points_count: z.number(),
      errors: z.string().optional(),
    })
    .optional(),
  event_counts_24h: z.record(z.number()).optional(),
  seed_minimal: z.object({ enabled: z.boolean(), reason: z.string(), fix_steps: z.array(z.string()).optional() }),
  openai: z.object({ enabled: z.boolean(), reason: z.string(), fix_steps: z.array(z.string()).optional() }),
  can_read_analytics: z.boolean().optional(),
  devtools_reason: z.string().optional(),
  openai_reason: z.string().optional(),
  recommended_fixes: z
    .array(
      z.object({
        key: z.string(),
        title: z.string(),
        why: z.string(),
        action_endpoint: z.string().optional(),
      }),
    )
    .optional(),
  issues: z.array(z.string()),
  fixes: z.array(z.string()),
});

export const liveEventsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      event_name: z.string(),
      user_id: z.string().nullable(),
      created_at: z.string(),
      path: z.string().nullable().optional(),
      properties: z.record(z.unknown()).optional(),
    }),
  ),
});
