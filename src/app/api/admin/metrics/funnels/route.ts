import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { canonicalizeEventName, aliasesForCanonicals } from "@/server/event-dictionary";
import { supabaseAdmin } from "@/supabase/admin";

const funnelSteps = [
  "register_started",
  "telegram_verified",
  "registration_completed",
  "profile_completed",
  "first_post",
  "event_joined",
  "connect_replied",
] as const;

function aliasesForStep(step: (typeof funnelSteps)[number]) {
  if (step === "first_post") return aliasesForCanonicals(["post_published_daily_duo", "post_published_video"]);
  if (step === "event_joined") return aliasesForCanonicals(["event_joined"]);
  if (step === "connect_replied") return aliasesForCanonicals(["connect_replied"]);
  return aliasesForCanonicals([step]);
}

function canonicalStepFromEventName(eventName: string) {
  const canonical = canonicalizeEventName(eventName);
  if (canonical === "post_published_daily_duo" || canonical === "post_published_video") return "first_post";
  if (canonical === "event_joined") return "event_joined";
  if (canonical === "connect_replied") return "connect_replied";
  if (canonical === "register_started") return "register_started";
  if (canonical === "telegram_verified") return "telegram_verified";
  if (canonical === "registration_completed") return "registration_completed";
  if (canonical === "profile_completed") return "profile_completed";
  return null;
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

    const allNames = aliasesForCanonicals([
      "register_started",
      "telegram_verified",
      "registration_completed",
      "profile_completed",
      "post_published_daily_duo",
      "post_published_video",
      "event_joined",
      "connect_replied",
    ]);

    const { data } = await supabaseAdmin
      .from("analytics_events")
      .select("event_name,user_id")
      .in("event_name", allNames)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(120000);

    const rows = (data ?? []).filter((x) => !userIds || (x.user_id && userIds.includes(x.user_id)));

    const stepUsers = new Map<string, Set<string>>();
    for (const step of funnelSteps) stepUsers.set(step, new Set());

    for (const row of rows) {
      if (!row.user_id) continue;
      const step = canonicalStepFromEventName(row.event_name);
      if (!step) continue;
      const set = stepUsers.get(step);
      if (!set) continue;
      set.add(row.user_id);
    }

    const base = stepUsers.get("register_started")?.size ?? 0;
    const steps = funnelSteps.map((step, idx) => {
      const count = stepUsers.get(step)?.size ?? 0;
      const prevStep = idx > 0 ? funnelSteps[idx - 1] : step;
      const prev = stepUsers.get(prevStep)?.size ?? 0;
      const drop = prev > 0 ? Number((1 - count / prev).toFixed(3)) : 0;
      const conversionFromStart = base > 0 ? Number((count / base).toFixed(3)) : 0;
      return { step, count, drop, conversionFromStart };
    });

    return ok({ range: { from: fromISO, to: toISO, segment: parsed.data.segment }, steps });
  } catch {
    return fail("Forbidden", 403);
  }
}
