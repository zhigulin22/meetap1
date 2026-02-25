import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

const funnelSteps = [
  "register_started",
  "telegram_verified",
  "registration_completed",
  "profile_completed",
  "daily_duo_published",
  "event_joined",
  "connect_clicked",
  "first_message_sent",
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

    const { data } = await supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id")
      .in("event_name", [...funnelSteps])
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(50000);

    const rows = (data ?? []).filter((x) => !userIds || (x.user_id && userIds.includes(x.user_id)));

    const stepUsers = new Map<string, Set<string>>();
    for (const step of funnelSteps) stepUsers.set(step, new Set());

    for (const row of rows) {
      if (!row.user_id) continue;
      const set = stepUsers.get(row.event_name);
      if (!set) continue;
      set.add(row.user_id);
    }

    const base = stepUsers.get(funnelSteps[0])?.size ?? 0;
    const steps = funnelSteps.map((step, idx) => {
      const count = stepUsers.get(step)?.size ?? 0;
      const prev = idx === 0 ? count : stepUsers.get(funnelSteps[idx - 1])?.size ?? 0;
      const drop = prev > 0 ? Number((1 - count / prev).toFixed(3)) : 0;
      const conversionFromStart = base > 0 ? Number((count / base).toFixed(3)) : 0;
      return { step, count, drop, conversionFromStart };
    });

    return ok({ range: { from: fromISO, to: toISO, segment: parsed.data.segment }, steps });
  } catch {
    return fail("Forbidden", 403);
  }
}
