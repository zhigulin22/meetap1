import { z } from "zod";
import OpenAI from "openai";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  question: z.string().min(3).max(1000),
});

export async function POST(req: Request) {
  try {
    await requireAdminUserId();

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const [usersCount, openFlagsCount, blockedCount, topEvents, recentFlags, recentComments] = await Promise.all([
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true),
      supabaseAdmin.from("analytics_events").select("event_name,created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin
        .from("user_flags")
        .select("user_id,source,severity,reason,created_at,status")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("comments")
        .select("user_id,content,created_at")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    const eventMap = new Map<string, number>();
    for (const e of topEvents.data ?? []) {
      eventMap.set(e.event_name, (eventMap.get(e.event_name) ?? 0) + 1);
    }

    const snapshot = {
      users_total: usersCount.count ?? 0,
      open_flags: openFlagsCount.count ?? 0,
      blocked_users: blockedCount.count ?? 0,
      top_events: [...eventMap.entries()].sort((a: any, b: any) => b[1] - a[1]).slice(0, 10),
      recent_flags: recentFlags.data ?? [],
      recent_comments: recentComments.data ?? [],
    };

    const env = getServerEnv();
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const system = `
Ты AI-ассистент админ-панели социальной сети офлайн-знакомств.
Твоя задача: помогать с метриками, конверсиями, рисками безопасности и приоритетами продукта.
Нельзя раскрывать лишние персональные данные.
Формат ответа строго JSON: {
  "summary": string,
  "risks": string[],
  "actions": string[],
  "queries": string[]
}
`;

    const user = `
Вопрос админа: ${parsed.data.question}
Данные снапшота: ${JSON.stringify(snapshot).slice(0, 12000)}
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
            name: "admin_assistant",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                risks: { type: "array", items: { type: "string" } },
                actions: { type: "array", items: { type: "string" } },
                queries: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "risks", "actions", "queries"],
              additionalProperties: false,
            },
          },
        },
      } as any),
      new Promise<null>((resolve: any) => setTimeout(() => resolve(null), 12000)),
    ]);

    if (!response) {
      return ok({
        summary: "AI не ответил вовремя. Используйте готовые метрики ниже.",
        risks: ["Проверьте открытые флаги и резкий рост жалоб"],
        actions: ["Проверить top events", "Проверить пользователей с высоким числом флагов"],
        queries: ["поиск: наркот", "поиск: взрыв", "поиск: заклад"],
      });
    }

    return ok(JSON.parse(response.output_text));
  } catch {
    return fail("Forbidden", 403);
  }
}
