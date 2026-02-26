import OpenAI from "openai";
import { aiInsightsSchema } from "@/lib/admin-schemas";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

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
      supabaseAdmin.from("alerts").select("type,metric,threshold,window,status,last_triggered_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("experiments").select("key,status,rollout_percent,primary_metric,start_at,end_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const eventRows = events.data ?? [];
    const eventCounter = new Map<string, number>();
    for (const row of eventRows) eventCounter.set(row.event_name, (eventCounter.get(row.event_name) ?? 0) + 1);

    const summaryContext = {
      topEvents: [...eventCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16),
      openReports: (reports.data ?? []).filter((x) => x.status === "open").length,
      openFlags: (flags.data ?? []).filter((x) => x.status === "open").length,
      highRiskFlags: (flags.data ?? []).filter((x) => (x.risk_score ?? 0) >= 80).length,
      alerts: alerts.data ?? [],
      experiments: experiments.data ?? [],
      customContext: parsed.data.context ?? {},
    };

    const env = getServerEnv();
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const system = `
Ты AI аналитик админки социальной платформы знакомств.
Отвечай строго JSON:
{
  "summary": string,
  "key_findings": string[],
  "evidence": string[],
  "recommended_actions": string[]
}
- Не повторяй одни и те же фразы.
- Опирайся на переданные данные.
- recommended_actions должны быть прикладными (эксперимент, alert, remote config, модерация).
`;

    const userPrompt = `
Вопрос: ${parsed.data.question}
Срез данных: ${JSON.stringify(summaryContext).slice(0, 120000)}
`;

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
            name: "admin_ai_insights_v2",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                key_findings: { type: "array", items: { type: "string" } },
                evidence: { type: "array", items: { type: "string" } },
                recommended_actions: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "key_findings", "evidence", "recommended_actions"],
              additionalProperties: false,
            },
          },
        },
      } as any),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
    ]);

    if (!response) {
      return ok({
        summary: "AI временно недоступен. Используйте панели Метрики/Воронки/Риск для ручного разбора.",
        key_findings: [
          `Открытые жалобы: ${summaryContext.openReports}`,
          `Открытые флаги: ${summaryContext.openFlags}`,
          `High risk флаги: ${summaryContext.highRiskFlags}`,
        ],
        evidence: summaryContext.topEvents.slice(0, 5).map((x) => `${x[0]}: ${x[1]}`),
        recommended_actions: [
          "Создать alert на рост open reports > 25% неделя к неделе",
          "Проверить drop-off в воронке registration_completed → profile_completed",
          "Запустить A/B тест упрощенного onboarding",
        ],
      });
    }

    return ok(JSON.parse(response.output_text));
  } catch {
    return fail("Forbidden", 403);
  }
}
