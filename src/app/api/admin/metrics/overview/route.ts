import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow, getSegmentUserIds, filterCountByUsers } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

async function countEvents(eventName: string, fromISO: string, toISO: string, userIds: string[] | null) {
  const query = supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", eventName)
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (userIds && userIds.length) {
    query.in("user_id", userIds);
  }

  const { count } = await query;
  return count ?? 0;
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

    const now = new Date();
    const d1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersTotal,
      newUsers1d,
      newUsers7d,
      verifiedUsers,
      dau,
      wau,
      mau,
      registerStarted,
      telegramVerified,
      registrationCompleted,
      dailyDuo1d,
      dailyDuo7d,
      eventJoin1d,
      eventJoin7d,
      connectClicked,
      chatsStarted,
      reportsOpen,
      flagsOpen,
      blockedUsers,
    ] = await Promise.all([
      filterCountByUsers("users", "id", fromISO, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d1, toISO, userIds, "created_at"),
      filterCountByUsers("users", "id", d7, toISO, userIds, "created_at"),
      (() => {
        const q = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("telegram_verified", true);
        if (userIds && userIds.length) q.in("id", userIds);
        return q.then((x) => x.count ?? 0);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d1);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d7);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      (() => {
        const q = supabaseAdmin.from("user_sessions").select("user_id").gte("last_active_at", d30);
        if (userIds && userIds.length) q.in("user_id", userIds);
        return q.then((x) => new Set((x.data ?? []).map((r) => r.user_id)).size);
      })(),
      countEvents("register_started", fromISO, toISO, userIds),
      countEvents("telegram_verified", fromISO, toISO, userIds),
      countEvents("registration_completed", fromISO, toISO, userIds),
      countEvents("daily_duo_published", d1, toISO, userIds),
      countEvents("daily_duo_published", d7, toISO, userIds),
      countEvents("event_joined", d1, toISO, userIds),
      countEvents("event_joined", d7, toISO, userIds),
      countEvents("connect_clicked", fromISO, toISO, userIds),
      countEvents("first_message_sent", fromISO, toISO, userIds),
      (() => {
        const q = supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open");
        return q.then((x) => x.count ?? 0);
      })(),
      (() => {
        const q = supabaseAdmin.from("content_flags").select("id", { count: "exact", head: true }).eq("status", "open");
        return q.then((x) => x.count ?? 0);
      })(),
      (() => {
        const q = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true);
        if (userIds && userIds.length) q.in("id", userIds);
        return q.then((x) => x.count ?? 0);
      })(),
    ]);

    const dauMau = mau > 0 ? Number((dau / mau).toFixed(3)) : 0;

    return ok({
      range: { from: fromISO, to: toISO, segment: parsed.data.segment },
      overview: {
        usersTotal,
        dau,
        wau,
        mau,
        dauMau,
        newUsers1d,
        newUsers7d,
        telegramVerifiedRate: registerStarted > 0 ? Number((telegramVerified / registerStarted).toFixed(3)) : 0,
        registrationCompletedRate: registerStarted > 0 ? Number((registrationCompleted / registerStarted).toFixed(3)) : 0,
        verifiedUsers,
        dailyDuo1d,
        dailyDuo7d,
        eventJoin1d,
        eventJoin7d,
        connectClicked,
        chatsStarted,
        reportsOpen,
        flagsOpen,
        blockedUsers,
      },
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
