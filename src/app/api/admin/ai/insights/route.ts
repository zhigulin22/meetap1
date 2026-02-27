import OpenAI from "openai";
import { z } from "zod";
import { aiInsightsSchema } from "@/lib/admin-schemas";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

type ActionType = "create_alert" | "create_experiment" | "update_flag";

type SuggestionAction = {
  id: string;
  type: ActionType;
  label: string;
  payload: Record<string, unknown>;
};

const aiOutputSchema = z.object({
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
});

function buildFallbackActions(openReports: number, topEvents: Array<[string, number]>): SuggestionAction[] {
  const registerStarted = topEvents.find((x: any) => x[0] === "register_started")?.[1] ?? 0;
  const verified = topEvents.find((x: any) => x[0] === "telegram_verified")?.[1] ?? 0;
  const tgDrop = registerStarted > 0 ? Number((1 - verified / registerStarted).toFixed(2)) : 0.25;

  return [
    {
      id: "alert_tg_verify_drop",
      type: "create_alert",
      label: "Создать алерт на падение Telegram verify",
      payload: {
        type: "drop",
        metric: "tg_verify_rate",
        threshold: Math.min(0.8, Math.max(0.1, tgDrop)),
        window_days: 7,
        status: "active",
      },
    },
    {
      id: "experiment_onboarding_short",
      type: "create_experiment",
      label: "Запустить A/B тест сокращенного onboarding",
      payload: {
        key: `exp_onboarding_short_${Date.now()}`,
        rollout_percent: 20,
        status: "draft",
        primary_metric: "registration_completed_rate",
        variants: { A: "current", B: "short_onboarding" },
      },
    },
    {
      id: "flag_feed_lock_days",
      type: "update_flag",
      label: "Смягчить feed lock до 5 дней",
      payload: {
        key: "feed_lock_days",
        enabled: true,
        rollout: 100,
        scope: "global",
        payload: { value: 5 },
        description: openReports > 20 ? "AI: снизить фрустрацию пользователей" : "AI suggestion",
      },
    },
  ];
}

export async function POST(req: Request) {
  try {
    await requireAdminUserId();

    const body = await req.json().catch(() => null);
    const parsed = aiInsightsSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const [events, reports, flags, alerts, experiments] = await Promise.all([
      supabaseAdmin.from("analytics_events").select("event_name,user_id,properties,created_at").order("created_at", { ascending: false }).limit(4000),
      supabaseAdmin.from("reports").select("status,reason,content_type,created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("content_flags").select("status,reason,risk_score,content_type,created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("alerts").select("type,metric,threshold,alert_window,status,last_triggered_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("experiments").select("key,status,rollout_percent,primary_metric,start_at,end_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const eventRows = events.data ?? [];
    const eventCounter = new Map<string, number>();
    for (const row of eventRows) eventCounter.set(row.event_name, (eventCounter.get(row.event_name) ?? 0) + 1);

    const topEvents = [...eventCounter.entries()].sort((a: any, b: any) => b[1] - a[1]).slice(0, 16);

    const summaryContext = {
      topEvents,
      openReports: (reports.data ?? []).filter((x: any) => x.status === "open").length,
      openFlags: (flags.data ?? []).filter((x: any) => x.status === "open").length,
      highRiskFlags: (flags.data ?? []).filter((x: any) => (x.risk_score ?? 0) >= 80).length,
      alerts: (alerts.data ?? []).slice(0, 25),
      experiments: (experiments.data ?? []).slice(0, 25),
      customContext: parsed.data.context ?? {},
    };

    const fallbackActions = buildFallbackActions(summaryContext.openReports, topEvents);

    const env = getServerEnv();
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const system = `
Ты AI аналитик админки социальной платформы знакомств.
Отвечай строго JSON:
{
  "summary": string,
  "key_findings": string[],
  "evidence": string[],
  "recommended_actions": string[],
  "actions": [{"id": string, "type": "create_alert"|"create_experiment"|"update_flag", "label": string, "payload": object}]
}
- Не повторяй одни и те же фразы.
- Опирайся только на переданные агрегаты.
- Рекомендации должны быть исполнимыми в admin UI.
`;

    const userPrompt = `
Вопрос: ${parsed.data.question}
Срез данных: ${JSON.stringify(summaryContext).slice(0, 120000)}
`;

    let usedFallback = false;
    let modelError = "";

    try {
      const response = await Promise.race([
        client.responses.create({
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "admin_ai_insights_v3",
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  key_findings: { type: "array", items: { type: "string" } },
                  evidence: { type: "array", items: { type: "string" } },
                  recommended_actions: { type: "array", items: { type: "string" } },
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["create_alert", "create_experiment", "update_flag"] },
                        label: { type: "string" },
                        payload: { type: "object" },
                      },
                      required: ["id", "type", "label", "payload"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "key_findings", "evidence", "recommended_actions", "actions"],
                additionalProperties: false,
              },
            },
          },
        } as any),
        new Promise<null>((resolve: any) => setTimeout(() => resolve(null), 14000)),
      ]);

      if (!response) {
        usedFallback = true;
      } else {
        const raw = response.output_text;
        const parsedOut = aiOutputSchema.safeParse(JSON.parse(raw));
        if (parsedOut.success) {
          return ok({
            ...parsedOut.data,
            debug: parsed.data.debug
              ? {
                  used_fallback: false,
                  context: summaryContext,
                }
              : undefined,
          });
        }
        usedFallback = true;
        modelError = parsedOut.error.issues[0]?.message ?? "AI schema mismatch";
      }
    } catch (error) {
      usedFallback = true;
      modelError = error instanceof Error ? error.message : "AI request failed";
    }

    const fallback = {
      summary: "AI выдал fallback-анализ на текущих метриках.",
      key_findings: [
        `Открытые жалобы: ${summaryContext.openReports}`,
        `Открытые флаги: ${summaryContext.openFlags}`,
        `High risk флаги: ${summaryContext.highRiskFlags}`,
      ],
      evidence: topEvents.slice(0, 5).map((x: any) => `${x[0]}: ${x[1]}`),
      recommended_actions: fallbackActions.map((x: any) => x.label),
      actions: fallbackActions,
      debug: parsed.data.debug
        ? {
            used_fallback: usedFallback,
            context: summaryContext,
            error: modelError || undefined,
          }
        : undefined,
    };

    return ok(fallback);
  } catch {
    return fail("Forbidden", 403);
  }
}
