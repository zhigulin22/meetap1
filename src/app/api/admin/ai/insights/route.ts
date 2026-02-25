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

    const [overview, funnels, retention, reports, flags] = await Promise.all([
      supabaseAdmin.from("analytics_events").select("event_name,created_at").order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("analytics_events").select("event_name,user_id,created_at").order("created_at", { ascending: false }).limit(3000),
      supabaseAdmin.from("users").select("id,created_at,telegram_verified,profile_completed").order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("reports").select("id,reason,status,content_type,created_at").order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("content_flags").select("id,reason,status,risk_score,content_type,created_at").order("created_at", { ascending: false }).limit(300),
    ]);

    const context = {
      events: overview.data ?? [],
      funnelEvents: funnels.data ?? [],
      users: retention.data ?? [],
      reports: reports.data ?? [],
      flags: flags.data ?? [],
      customContext: parsed.data.context ?? {},
    };

    const env = getServerEnv();
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const system = `
You are a principal product analyst AI for a social network admin panel.
Respond strictly as JSON with keys:
summary: string,
anomalies: string[],
causes: string[],
actions: string[],
sql: string[],
filters: string[],
riskAlerts: string[]
`;

    const user = `
Question: ${parsed.data.question}
Data snapshot: ${JSON.stringify(context).slice(0, 120000)}
`;

    const response = await Promise.race([
      client.responses.create({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "admin_ai_insights",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                anomalies: { type: "array", items: { type: "string" } },
                causes: { type: "array", items: { type: "string" } },
                actions: { type: "array", items: { type: "string" } },
                sql: { type: "array", items: { type: "string" } },
                filters: { type: "array", items: { type: "string" } },
                riskAlerts: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "anomalies", "causes", "actions", "sql", "filters", "riskAlerts"],
              additionalProperties: false,
            },
          },
        },
      } as any),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);

    if (!response) {
      return ok({
        summary: "AI timeout. Используйте стандартные метрики и ручной анализ секций Overview/Funnels/Retention.",
        anomalies: ["Проверьте резкий рост reports/flags", "Проверьте падение registration_completed_rate"],
        causes: ["Нестабильный onboarding", "Аномальная активность спама"],
        actions: ["Проверить флаги high risk", "Разобрать drop-off между telegram_verified и registration_completed"],
        sql: ["select event_name,count(*) from analytics_events group by 1 order by 2 desc;"],
        filters: ["segment=verified", "range=last_14d"],
        riskAlerts: ["При росте high-risk flags > 30% активировать stricter moderation"],
      });
    }

    return ok(JSON.parse(response.output_text));
  } catch {
    return fail("Forbidden", 403);
  }
}
