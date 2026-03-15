import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekStartISO(d: Date) {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  date.setUTCHours(0, 0, 0, 0);
  return toDay(date);
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

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 90);
    const segmentUserIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);

    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id,created_at")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: true })
      .limit(20000);

    const filteredUsers = (users ?? []).filter((u: any) => !segmentUserIds || segmentUserIds.includes(u.id));
    const userIds = filteredUsers.map((u: any) => u.id);

    const { data: events } = userIds.length
      ? await supabaseAdmin
          .from("analytics_events")
          .select("user_id,created_at")
          .in("user_id", userIds)
          .gte("created_at", fromISO)
          .lte("created_at", new Date(new Date(toISO).getTime() + 31 * 24 * 60 * 60 * 1000).toISOString())
          .limit(120000)
      : { data: [] as Array<{ user_id: string; created_at: string }> };

    const activeDays = new Map<string, Set<string>>();
    for (const e of events ?? []) {
      const day = e.created_at.slice(0, 10);
      const set = activeDays.get(e.user_id) ?? new Set<string>();
      set.add(day);
      activeDays.set(e.user_id, set);
    }

    const cohorts = new Map<
      string,
      {
        users: Array<{ id: string; createdAtDay: string }>;
      }
    >();

    for (const u of filteredUsers) {
      const createdDate = new Date(u.created_at);
      const week = weekStartISO(createdDate);
      const list = cohorts.get(week) ?? { users: [] };
      list.users.push({ id: u.id, createdAtDay: toDay(createdDate) });
      cohorts.set(week, list);
    }

    const rows = [...cohorts.entries()]
      .sort((a: any, b: any) => (a[0] < b[0] ? -1 : 1))
      .map(([week, value]) => {
        const cohortSize = value.users.length;

        let d1 = 0;
        let d7 = 0;
        let d30 = 0;

        for (const user of value.users) {
          const base = new Date(`${user.createdAtDay}T00:00:00.000Z`);
          const d1Key = toDay(new Date(base.getTime() + 1 * 24 * 60 * 60 * 1000));
          const d7Key = toDay(new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000));
          const d30Key = toDay(new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000));
          const days = activeDays.get(user.id) ?? new Set<string>();

          if (days.has(d1Key)) d1 += 1;
          if (days.has(d7Key)) d7 += 1;
          if (days.has(d30Key)) d30 += 1;
        }

        return {
          cohortWeek: week,
          cohortSize,
          d1Rate: cohortSize > 0 ? Number((d1 / cohortSize).toFixed(3)) : 0,
          d7Rate: cohortSize > 0 ? Number((d7 / cohortSize).toFixed(3)) : 0,
          d30Rate: cohortSize > 0 ? Number((d30 / cohortSize).toFixed(3)) : 0,
        };
      });

    return ok({ range: { from: fromISO, to: toISO, segment: parsed.data.segment }, cohorts: rows });
  } catch (error) {
    return adminRouteError("/api/admin/metrics/retention", error);
  }
}
