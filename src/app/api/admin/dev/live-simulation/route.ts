import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";

type LiveState = {
  running: boolean;
  intervalSec: number;
  eventsPerTick: number;
  totalGenerated: number;
  lastTickAt: number;
};

const globalAny = globalThis as unknown as { __liveSimState?: LiveState };
globalAny.__liveSimState = globalAny.__liveSimState ?? {
  running: false,
  intervalSec: 8,
  eventsPerTick: 20,
  totalGenerated: 0,
  lastTickAt: 0,
};

const schema = z.object({
  action: z.enum(["start", "stop", "tick"]),
  intervalSec: z.number().int().min(2).max(60).optional(),
  eventsPerTick: z.number().int().min(1).max(300).optional(),
});

const EVENT_NAMES = [
  "event_viewed",
  "event_joined",
  "connect_sent",
  "connect_replied",
  "chat_message_sent",
  "post_published_daily_duo",
  "post_published_video",
  "ai_cost",
] as const;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function tickGenerate(count: number) {
  const { data: users } = await supabaseAdmin.from("users").select("id").limit(500);
  const ids = (users ?? []).map((u) => u.id);
  if (!ids.length) return 0;

  const rows = [] as Array<{ event_name: string; user_id: string; path: string; properties: Record<string, unknown>; created_at: string }>;
  for (let i = 0; i < count; i += 1) {
    const name = EVENT_NAMES[rnd(0, EVENT_NAMES.length - 1)] ?? "event_viewed";
    rows.push({
      event_name: name,
      user_id: ids[rnd(0, ids.length - 1)] as string,
      path: name.includes("event") ? "/events" : name.includes("connect") ? "/contacts" : "/feed",
      properties: { source: "live_sim", usd: name === "ai_cost" ? Number((Math.random() * 0.05).toFixed(4)) : undefined },
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin.from("analytics_events").insert(rows);
  return rows.length;
}

export async function GET() {
  try {
    await requireAdminUserId();

    const state = globalAny.__liveSimState as LiveState;
    if (state.running) {
      const now = Date.now();
      if (now - state.lastTickAt >= state.intervalSec * 1000) {
        const generated = await tickGenerate(state.eventsPerTick);
        state.totalGenerated += generated;
        state.lastTickAt = now;
      }
    }

    return ok(state);
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();

    if (process.env.NODE_ENV === "production" && process.env.ADMIN_DEVTOOLS_ENABLED !== "true") {
      return fail("Devtools disabled", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const state = globalAny.__liveSimState as LiveState;

    if (parsed.data.action === "start") {
      state.running = true;
      state.intervalSec = parsed.data.intervalSec ?? state.intervalSec;
      state.eventsPerTick = parsed.data.eventsPerTick ?? state.eventsPerTick;
      state.lastTickAt = 0;
      await logAdminAction({ adminId, action: "live_sim_start", targetType: "system", meta: { intervalSec: state.intervalSec, eventsPerTick: state.eventsPerTick } });
    }

    if (parsed.data.action === "stop") {
      state.running = false;
      await logAdminAction({ adminId, action: "live_sim_stop", targetType: "system", meta: { totalGenerated: state.totalGenerated } });
    }

    if (parsed.data.action === "tick") {
      const generated = await tickGenerate(parsed.data.eventsPerTick ?? state.eventsPerTick);
      state.totalGenerated += generated;
      state.lastTickAt = Date.now();
    }

    return ok(state);
  } catch {
    return fail("Forbidden", 403);
  }
}
