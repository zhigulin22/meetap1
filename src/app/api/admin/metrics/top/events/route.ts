import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { parseWindow } from "@/server/admin-metrics";
import { aliasesForCanonicals, canonicalizeEventName } from "@/server/event-dictionary";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

type EventRow = {
  id: string;
  title?: string | null;
  location?: string | null;
  city?: string | null;
};

const schema = z.object({
  metric: z.enum(["joins", "views"]).default("joins"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

async function loadEventMap(ids: string[]) {
  if (!ids.length) return new Map<string, EventRow>();
  const snap = await getSchemaSnapshot(["events"]);
  const eventCols = asSet(snap, "events");
  if (!eventCols.has("id")) return new Map<string, EventRow>();

  const selectCols = ["id", "title", "location", "city"].filter((c) => eventCols.has(c));
  if (!selectCols.includes("id")) selectCols.unshift("id");

  const events = await supabaseAdmin.from("events").select(selectCols.join(",")).in("id", ids.slice(0, 5000));
  return new Map<string, EventRow>(((events.data ?? []) as EventRow[]).map((x) => [x.id, x]));
}

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
      const counts = new Map<string, number>();

      const members = await supabaseAdmin
        .from("event_members")
        .select("event_id,created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(100000);

      for (const row of members.data ?? []) {
        if (!row.event_id) continue;
        counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
      }

      if (!counts.size) {
        const analytics = await supabaseAdmin
          .from("analytics_events")
          .select("event_name,properties,created_at")
          .in("event_name", aliasesForCanonicals(["event_joined"]))
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .limit(100000);

        for (const row of analytics.data ?? []) {
          if (canonicalizeEventName(row.event_name) !== "event_joined") continue;
          const eventId = String((row.properties as Record<string, unknown> | null)?.event_id ?? "").trim();
          if (!eventId) continue;
          counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
        }
      }

      const ids = [...counts.keys()];
      const eventMap = await loadEventMap(ids);

      const items = [...counts.entries()]
        .map(([event_id, value]) => ({
          event_id,
          value,
          title: eventMap.get(event_id)?.title ?? `Event ${event_id.slice(0, 8)}`,
          location: eventMap.get(event_id)?.location ?? eventMap.get(event_id)?.city ?? null,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, parsed.data.limit);

      return ok({ metric: parsed.data.metric, items });
    }

    const views = await supabaseAdmin
      .from("analytics_events")
      .select("event_name,properties,created_at")
      .in("event_name", aliasesForCanonicals(["event_viewed"]))
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .limit(100000);

    const counts = new Map<string, number>();
    for (const row of views.data ?? []) {
      if (canonicalizeEventName(row.event_name) !== "event_viewed") continue;
      const props = row.properties as Record<string, unknown> | null;
      const eventId = String(props?.event_id ?? "").trim();
      if (!eventId || eventId === "undefined" || eventId === "null") continue;
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    }

    const ids = [...counts.keys()];
    const eventMap = await loadEventMap(ids);

    const items = [...counts.entries()]
      .map(([event_id, value]) => ({
        event_id,
        value,
        title: eventMap.get(event_id)?.title ?? `Event ${event_id.slice(0, 8)}`,
        location: eventMap.get(event_id)?.location ?? eventMap.get(event_id)?.city ?? null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, parsed.data.limit);

    return ok({ metric: parsed.data.metric, items });
  } catch {
    return fail("Forbidden", 403);
  }
}
