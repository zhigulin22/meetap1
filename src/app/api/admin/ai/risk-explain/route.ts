import OpenAI from "openai";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";

const schema = z.object({
  user_id: z.string().uuid(),
  signals: z.array(z.object({
    key: z.string(),
    label: z.string().optional(),
    value: z.number().optional(),
    severity: z.number().optional(),
    evidence: z.record(z.unknown()).optional(),
  })).default([]),
  last_events_summary: z.record(z.unknown()).optional(),
});

const outputSchema = z.object({
  summary: z.string(),
  why: z.array(z.string()),
  recommended_actions: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const fallback = {
      summary: "Риск-профиль сформирован на основе rule-based сигналов.",
      why: parsed.data.signals.slice(0, 5).map((s: any) => `${s.label ?? s.key}: ${s.value ?? "n/a"}`),
      recommended_actions: [
        "Ограничить лимит connect/day и наблюдать 24ч",
        "Проверить последние жалобы и повторяющиеся сообщения",
        "Если сигналы падают — mark safe",
      ],
    };

    const env = getServerEnv();
    if (!env.OPENAI_API_KEY) return ok(fallback);

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await Promise.race([
      client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "Ты AI аналитик risk center. Верни строго JSON: {summary:string, why:string[], recommended_actions:string[]}. Без PII.",
          },
          {
            role: "user",
            content: JSON.stringify({
              user_id: parsed.data.user_id,
              signals: parsed.data.signals,
              last_events_summary: parsed.data.last_events_summary ?? {},
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "risk_explain_output",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                why: { type: "array", items: { type: "string" } },
                recommended_actions: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "why", "recommended_actions"],
              additionalProperties: false,
            },
          },
        },
      } as any),
      new Promise<null>((resolve: any) => setTimeout(() => resolve(null), 12000)),
    ]);

    if (!response) return ok(fallback);
    const parsedOut = outputSchema.safeParse(JSON.parse(response.output_text));
    if (!parsedOut.success) return ok(fallback);

    return ok(parsedOut.data);
  } catch {
    return fail("Forbidden", 403);
  }
}
