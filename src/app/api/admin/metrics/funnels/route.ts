import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { canonicalizeEventName, aliasesForCanonicals } from "@/server/event-dictionary";
import { supabaseAdmin } from "@/supabase/admin";

type AnalyticsRow = {
  event_name: string;
  user_id: string | null;
  properties?: Record<string, unknown> | null;
};

const funnelSteps = [
  "auth.register_started",
  "auth.telegram_verified",
  "auth.registration_completed",
  "profile.completed",
  "first_action",
  "chat.connect_replied",
] as const;

type FunnelStep = (typeof funnelSteps)[number];

function aliasesForStep(step: FunnelStep) {
  if (step === "first_action") {
    return aliasesForCanonicals([
      "feed.post_published_daily_duo",
      "feed.post_published_video",
      "events.joined",
      "post_published_daily_duo",
      "post_published_video",
      "event_joined",
    ]);
  }
  return aliasesForCanonicals([step]);
}

function canonicalStepFromEventName(eventName: string): FunnelStep | null {
  const canonical = canonicalizeEventName(eventName);

  if (canonical === "register_started") return "auth.register_started";
  if (canonical === "telegram_verified") return "auth.telegram_verified";
  if (canonical === "registration_completed") return "auth.registration_completed";
  if (canonical === "profile_completed") return "profile.completed";

  if (canonical === "post_published_daily_duo" || canonical === "post_published_video" || canonical === "event_joined") {
    return "first_action";
  }

  if (canonical === "connect_replied") return "chat.connect_replied";
  return null;
}

function rowActorId(row: AnalyticsRow) {
  if (row.user_id) return row.user_id;
  const actorKey = String((row.properties?.actor_key as string | undefined) ?? "").trim();
  if (!actorKey) return null;
  return `anon:${actorKey}`;
}

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

    const allNames = Array.from(new Set(funnelSteps.flatMap((step: any) => aliasesForStep(step))));

    const { data } = await supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id,properties")
      .in("event_name", allNames)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(120000);

    const rows = (data ?? []).filter((x: any) => {
      if (!userIds) return true;
      if (x.user_id) return userIds.includes(x.user_id);
      return true;
    });

    const stepUsers = new Map<string, Set<string>>();
    for (const step of funnelSteps) stepUsers.set(step, new Set());

    for (const row of rows as AnalyticsRow[]) {
      const actorId = rowActorId(row);
      if (!actorId) continue;
      const step = canonicalStepFromEventName(row.event_name);
      if (!step) continue;
      stepUsers.get(step)?.add(actorId);
    }

    const base = stepUsers.get("auth.register_started")?.size ?? 0;
    const steps = funnelSteps.map((step, idx) => {
      const count = stepUsers.get(step)?.size ?? 0;
      const prevStep = idx > 0 ? funnelSteps[idx - 1] : step;
      const prev = stepUsers.get(prevStep)?.size ?? 0;
      const drop = prev > 0 ? Number((1 - count / prev).toFixed(3)) : 0;
      const conversionFromStart = base > 0 ? Number((count / base).toFixed(3)) : 0;
      return { step, count, drop, conversionFromStart };
    });

    return ok({ range: { from: fromISO, to: toISO, segment: parsed.data.segment }, steps });
  } catch (error) {
    return adminRouteError("/api/admin/metrics/funnels", error);
  }
}
