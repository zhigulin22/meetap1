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
      top_events: [...eventMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      recent_flags: recentFlags.data ?? [],
      recent_comments: recentComments.data ?? [],
    };

    const env = getServerEnv();
    const client = new OpenAI({
      apiKey: env.DEEPSEEK_API_KEY,
      baseURL: env.DEEPSEEK_BASE_URL,
    });

    const system = `Ты AI-ассистент админ-панели социальной сети офлайн-знакомств.
Твоя задача: помогать с метриками, конверсиями, рисками безопасности и приоритетами продукта.
Нельзя раскрывать лишние персональные данные.
Ответ строго в JSON: { "summary": string, "risks": string[], "actions": string[], "queries": string[] }`;

    const userMsg = `Вопрос: ${parsed.data.question}\nДанные: ${JSON.stringify(snapshot).slice(0, 12000)}`;

    const response = await Promise.race([
      client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);

    if (!response) {
      return ok({
        summary: "AI не ответил вовремя. Используйте готовые метрики ниже.",
        risks: ["Проверьте открытые флаги и резкий рост жалоб"],
        actions: ["Проверить top events", "Проверить пользователей с высоким числом флагов"],
        queries: ["поиск: наркот", "поиск: взрыв", "поиск: заклад"],
      });
    }

    return ok(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
  } catch {
    return fail("Forbidden", 403);
  }
}
