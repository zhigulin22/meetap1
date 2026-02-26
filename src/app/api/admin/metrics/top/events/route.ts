import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow } from "@/server/admin-metrics";
import { supabaseAdmin } from "@/supabase/admin";

type EventRow = {
  id: string;
  title: string | null;
  location: string | null;
};

const schema = z.object({
  metric: z.enum(["joins", "views"]).default("joins"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);

    const parsed = schema.safeParse({
      metric: searchParams.get("metric") ?? "joins",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit: searchParams.get("limit") ?? 20,
    });

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const { fromISO, toISO } = parseWindow(parsed.data.from, parsed.data.to, 30);

    if (parsed.data.metric === "joins") {
      const joins = await supabaseAdmin
        .from("event_members")
        .select("event_id")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(100000);

      const counts = new Map<string, number>();
      for (const row of joins.data ?? []) {
        if (!row.event_id) continue;
        counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
      }

      const ids = [...counts.keys()];
      const events = ids.length
        ? await supabaseAdmin.from("events").select("id,title,location").in("id", ids.slice(0, 5000))
        : { data: [] as EventRow[] };

      const eventMap = new Map<string, EventRow>(((events.data ?? []) as EventRow[]).map((x) => [x.id, x]));
      const items = [...counts.entries()]
        .map(([event_id, value]) => ({
          event_id,
          value,
          title: eventMap.get(event_id)?.title ?? `Event ${event_id.slice(0, 6)}`,
          location: eventMap.get(event_id)?.location ?? null,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, parsed.data.limit);

      return ok({ metric: parsed.data.metric, items });
    }

    const views = await supabaseAdmin
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "event_viewed")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(100000);

    const counts = new Map<string, number>();
    for (const row of views.data ?? []) {
      const props = row.properties as Record<string, unknown> | null;
      const eventId = String(props?.event_id ?? "");
      if (!eventId || eventId === "undefined" || eventId === "null") continue;
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    }

    const ids = [...counts.keys()].filter((x) => /^[0-9a-f-]{6,}$/i.test(x));
    const events = ids.length
      ? await supabaseAdmin.from("events").select("id,title,location").in("id", ids.slice(0, 5000))
      : { data: [] as EventRow[] };

    const eventMap = new Map<string, EventRow>(((events.data ?? []) as EventRow[]).map((x) => [x.id, x]));
    const items = [...counts.entries()]
      .map(([event_id, value]) => ({
        event_id,
        value,
        title: eventMap.get(event_id)?.title ?? `Event ${event_id.slice(0, 6)}`,
        location: eventMap.get(event_id)?.location ?? null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, parsed.data.limit);

    return ok({ metric: parsed.data.metric, items });
  } catch {
    return fail("Forbidden", 403);
  }
}
