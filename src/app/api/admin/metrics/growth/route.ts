import { fail, ok } from "@/lib/http";
import { metricsQuerySchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { getSegmentUserIds, parseWindow } from "@/server/admin-metrics";
import { getMetricsBlock } from "@/server/metrics-lab";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const parsed = metricsQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      segment: searchParams.get("segment") ?? "all",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);
    const userIds = await getSegmentUserIds(parsed.data.segment, fromISO, toISO);
    const block = await getMetricsBlock("growth", fromISO, toISO, userIds);
    return ok({ kind: "growth", range: { from: fromISO, to: toISO, segment: parsed.data.segment }, ...block });
  } catch {
    return fail("Forbidden", 403);
  }
}
