import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

type UserRow = {
  id: string;
  name: string | null;
  country: string | null;
};

const schema = z.object({
  metric: z.enum(["connect_sent", "event_joined", "post_published_daily_duo", "post_published_video", "reports_received"]).default("connect_sent"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      metric: searchParams.get("metric") ?? "connect_sent",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit: searchParams.get("limit") ?? 20,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);

    if (parsed.data.metric === "reports_received") {
      const reports = await supabaseAdmin
        .from("reports")
        .select("target_user_id")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(50000);

      const counts = new Map<string, number>();
      for (const row of reports.data ?? []) {
        if (!row.target_user_id) continue;
        counts.set(row.target_user_id, (counts.get(row.target_user_id) ?? 0) + 1);
      }

      const ids = [...counts.keys()];
      const users = ids.length
        ? await supabaseAdmin.from("users").select("id,name,country").in("id", ids.slice(0, 5000))
        : { data: [] as UserRow[] };
      const userMap = new Map<string, UserRow>(((users.data ?? []) as UserRow[]).map((u) => [u.id, u]));

      const items = [...counts.entries()]
        .map(([user_id, value]) => ({
          user_id,
          value,
          name: userMap.get(user_id)?.name ?? "Unknown",
          city: userMap.get(user_id)?.country ?? null,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, parsed.data.limit);

      return ok({ metric: parsed.data.metric, items });
    }

    const rows = await supabaseAdmin
      .from("analytics_events")
      .select("user_id")
      .eq("event_name", parsed.data.metric)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(100000);

    const counts = new Map<string, number>();
    for (const row of rows.data ?? []) {
      if (!row.user_id) continue;
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
    }

    const ids = [...counts.keys()];
    const users = ids.length
      ? await supabaseAdmin.from("users").select("id,name,country").in("id", ids.slice(0, 5000))
      : { data: [] as UserRow[] };
    const userMap = new Map<string, UserRow>(((users.data ?? []) as UserRow[]).map((u) => [u.id, u]));

    const items = [...counts.entries()]
      .map(([user_id, value]) => ({
        user_id,
        value,
        name: userMap.get(user_id)?.name ?? "Unknown",
        city: userMap.get(user_id)?.country ?? null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, parsed.data.limit);

    return ok({ metric: parsed.data.metric, items });
  } catch {
    return fail("Forbidden", 403);
  }
}
