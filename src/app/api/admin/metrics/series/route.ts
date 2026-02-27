import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { computeSeries } from "@/server/metrics-series";

const schema = z.object({
  metric: z.string().min(2),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  segment: z.enum(["all", "verified", "new", "active"]).default("all"),
  group_by: z.enum(["day"]).default("day"),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      metric: searchParams.get("metric") ?? "dau",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
      group_by: searchParams.get("group_by") ?? "day",
    });

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);
    const userIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);

    const series = await computeSeries({
      metric: parsed.data.metric,
      fromISO,
      toISO,
      userIds,
    });

    return ok(series);
  } catch {
    return fail("Forbidden", 403);
  }
}
