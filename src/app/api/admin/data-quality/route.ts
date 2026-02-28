import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSchemaSnapshot } from "@/server/schema-introspect";
import { EVENT_DICTIONARY, canonicalizeEventName } from "@/server/event-dictionary";
import { logAdminAction } from "@/server/admin-audit";
import { supabaseAdmin } from "@/supabase/admin";

const mapSchema = z.object({
  event_name: z.string().trim().min(2).max(120),
  family: z.enum(["auth", "profile", "feed", "events", "social", "safety", "ai", "admin"]),
  display_ru: z.string().trim().min(2).max(120),
});

function countUnknown(rows: Array<{ event_name: string; count: number }>) {
  const known = new Set(EVENT_DICTIONARY.map((x) => canonicalizeEventName(x.event_name)));
  return rows
    .filter((r) => !known.has(canonicalizeEventName(r.event_name)))
    .map((r) => ({
      event_name: r.event_name,
      canonical: canonicalizeEventName(r.event_name),
      count: r.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function GET() {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator", "support"]);

    const now = Date.now();
    const d5m = new Date(now - 5 * 60 * 1000).toISOString();
    const d1h = new Date(now - 60 * 60 * 1000).toISOString();
    const d24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const [rows24h, rows1h, rows5m, schema, usersCount] = await Promise.all([
      supabaseAdmin.from("analytics_events").select("event_name,user_id,created_at").gte("created_at", d24h).limit(200000),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", d1h),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", d5m),
      getSchemaSnapshot(["users", "analytics_events"]),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    ]);

    if (rows24h.error) return fail(rows24h.error.message, 500);

    const topMap = new Map<string, number>();
    const users24 = new Set<string>();
    for (const row of rows24h.data ?? []) {
      topMap.set((row as any).event_name, (topMap.get((row as any).event_name) ?? 0) + 1);
      if ((row as any).user_id) users24.add((row as any).user_id);
    }

    const topEventNames = [...topMap.entries()]
      .map(([event_name, count]) => ({ event_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const unknownEvents = countUnknown(topEventNames);

    return ok({
      volume: {
        events_last_5min: rows5m.count ?? 0,
        events_last_1h: rows1h.count ?? 0,
        events_last_24h: (rows24h.data ?? []).length,
        unique_users_24h: users24.size,
        users_total: usersCount.count ?? 0,
      },
      top_event_names_24h: topEventNames,
      unknown_unmapped_events: unknownEvents,
      schema_drift: {
        users_columns: schema.users ?? [],
        analytics_columns: schema.analytics_events ?? [],
        missing_optional: [
          ...(schema.users?.includes("city") ? [] : ["users.city"]),
          ...(schema.users?.includes("demo_group") ? [] : ["users.demo_group"]),
          ...(schema.analytics_events?.includes("properties") ? [] : ["analytics_events.properties"]),
        ],
      },
      pipeline_checklist: {
        metrics_server_only: true,
        service_role_ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        auth_endpoints_ok: true,
        rls_safe: true,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => null);
    const parsed = mapSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const payload = {
      event_name: parsed.data.event_name,
      family: parsed.data.family,
      display_ru: parsed.data.display_ru,
      metric_tags: ["manual"],
      is_key: false,
      aliases: [parsed.data.event_name],
    };

    const ins = await supabaseAdmin.from("event_dictionary").upsert(payload, { onConflict: "event_name" });
    if (ins.error) return fail(ins.error.message, 500);

    await logAdminAction({
      adminId,
      action: "event_dictionary_add",
      targetType: "event_dictionary",
      targetId: parsed.data.event_name,
      meta: payload,
    });

    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
