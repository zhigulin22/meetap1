import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  question: z.string().min(3).max(1000),
});

type AssistantResponse = {
  summary: string;
  risks: string[];
  actions: string[];
  queries: string[];
};

const fallback: AssistantResponse = {
  summary: "AI не ответил вовремя. Используйте готовые метрики ниже.",
  risks: ["Проверьте открытые флаги и резкий рост жалоб"],
  actions: ["Проверить top events", "Проверить пользователей с высоким числом флагов"],
  queries: ["поиск: наркот", "поиск: взрыв", "поиск: заклад"],
};

function stripTrailingSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function askPythonAssistant(question: string, snapshot: Record<string, unknown>) {
  const env = getServerEnv();
  const baseUrl = stripTrailingSlash(env.AI_SERVICE_URL);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${baseUrl}/v1/admin-assistant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, snapshot }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI service failed with status ${response.status}`);
    }

    const body = (await response.json()) as Partial<AssistantResponse>;

    if (!body.summary || !Array.isArray(body.risks) || !Array.isArray(body.actions) || !Array.isArray(body.queries)) {
      return fallback;
    }

    return {
      summary: String(body.summary),
      risks: body.risks.map((x) => String(x)).slice(0, 8),
      actions: body.actions.map((x) => String(x)).slice(0, 8),
      queries: body.queries.map((x) => String(x)).slice(0, 8),
    } satisfies AssistantResponse;
  } finally {
    clearTimeout(timeout);
  }
}

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

    try {
      const result = await askPythonAssistant(parsed.data.question, snapshot);
      return ok(result);
    } catch {
      return ok(fallback);
    }
  } catch {
    return fail("Forbidden", 403);
  }
}
