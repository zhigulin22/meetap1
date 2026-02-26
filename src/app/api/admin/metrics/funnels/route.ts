import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

const funnelSteps = [
  { step: "register_started", aliases: ["register_started"] },
  { step: "telegram_verified", aliases: ["telegram_verified"] },
  { step: "registration_completed", aliases: ["registration_completed"] },
  { step: "profile_completed", aliases: ["profile_completed"] },
  { step: "first_post", aliases: ["first_post", "post_published_daily_duo", "post_published_video", "daily_duo_published"] },
  { step: "first_event_join", aliases: ["first_event_join", "event_joined"] },
  { step: "connect_sent", aliases: ["connect_sent", "connect_clicked"] },
  { step: "replied", aliases: ["connect_replied", "first_message_sent"] },
  { step: "continued_d1", aliases: ["continued_d1", "chat_message_sent"] },
] as const;

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = metricsQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);
    const userIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);

    const allNames = [...new Set(funnelSteps.flatMap((step) => step.aliases))];

    const { data } = await supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id")
      .in("event_name", allNames)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(80000);

    const rows = (data ?? []).filter((x) => !userIds || (x.user_id && userIds.includes(x.user_id)));

    const eventUsers = new Map<string, Set<string>>();
    for (const name of allNames) eventUsers.set(name, new Set());

    for (const row of rows) {
      if (!row.user_id) continue;
      const set = eventUsers.get(row.event_name);
      if (!set) continue;
      set.add(row.user_id);
    }

    const stepCounts = funnelSteps.map((step) => {
      const merged = new Set<string>();
      for (const alias of step.aliases) {
        const users = eventUsers.get(alias);
        if (!users) continue;
        for (const userId of users) merged.add(userId);
      }
      return { step: step.step, users: merged };
    });

    const base = stepCounts[0]?.users.size ?? 0;
    const steps = stepCounts.map((row, idx) => {
      const count = row.users.size;
      const prev = idx === 0 ? count : stepCounts[idx - 1]?.users.size ?? 0;
      const drop = prev > 0 ? Number((1 - count / prev).toFixed(3)) : 0;
      const conversionFromStart = base > 0 ? Number((count / base).toFixed(3)) : 0;
      return { step: row.step, count, drop, conversionFromStart };
    });

    return ok({ range: { from: fromISO, to: toISO, segment: parsed.data.segment }, steps });
  } catch {
    return fail("Forbidden", 403);
  }
}
