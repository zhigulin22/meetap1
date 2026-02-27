import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import {
  enableDevtoolsSafeMode,
  getDevtoolsStatus,
  seedMinimalData,
  startSimulation,
} from "@/server/simulation";
import { supabaseAdmin } from "@/supabase/admin";
import { eventDictionarySeedRows } from "@/server/event-dictionary";
import { recomputeUserStatsDaily } from "@/server/recompute-aggregates";
import { computeSeries } from "@/server/metrics-series";
import { createMissingAdminTables } from "@/server/admin-tables";

const schema = z.object({
  action: z
    .enum([
      "run_all",
      "write_test_event",
      "seed_minimal",
      "start_live_40",
      "install_event_dictionary",
      "enable_devtools_safe_mode",
      "recompute_aggregates",
      "create_missing_tables",
    ])
    .default("run_all"),
});

async function runAction(action: z.infer<typeof schema>["action"], adminId: string) {
  const actions: string[] = [];

  if (action === "create_missing_tables") {
    const created = await createMissingAdminTables();
    actions.push(`create_missing_tables:${created.tables_present ? "ok" : "partial"}`);
    return {
      actions,
      created: created.created,
      tables_present: created.tables_present,
      missing_before: created.missing_before,
      missing_after: created.missing_after,
    };
  }

  if (action === "enable_devtools_safe_mode") {
    await enableDevtoolsSafeMode(adminId);
    actions.push("devtools_safe_mode_enabled");
    return { actions };
  }

  if (action === "install_event_dictionary") {
    const rows = eventDictionarySeedRows();
    const { error } = await supabaseAdmin.from("event_dictionary").upsert(rows, { onConflict: "event_name" });
    if (error) throw new Error(error.message);
    actions.push(`event_dictionary_upserted:${rows.length}`);
    return { actions };
  }

  if (action === "write_test_event") {
    await trackEvent({ eventName: "admin_test_event", userId: adminId, path: "/admin", properties: { source: "diagnostics_fix" } });
    actions.push("written_admin_test_event");
    const now = new Date().toISOString();
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const series = await computeSeries({ metric: "dau", fromISO: from, toISO: now, userIds: null });
    actions.push(`series_points:${series.points.length}`);
    return { actions, series_points: series.points.length };
  }

  if (action === "recompute_aggregates") {
    const res = await recomputeUserStatsDaily(90);
    actions.push(`recomputed_user_stats_daily:${res.rows}`);
    return { actions };
  }

  if (action === "seed_minimal") {
    const devtools = await getDevtoolsStatus();
    if (!devtools.enabled) throw new Error(`Devtools disabled: ${devtools.reason}`);
    const seeded = await seedMinimalData();
    actions.push(`seed_minimal_events:${seeded.events}`);
    return { actions };
  }

  if (action === "start_live_40") {
    const devtools = await getDevtoolsStatus();
    if (!devtools.enabled) throw new Error(`Devtools disabled: ${devtools.reason}`);
    const run = await startSimulation({
      adminId,
      usersCount: 40,
      intervalSec: 8,
      mode: "normal",
      intensity: "normal",
    });
    actions.push(`live_started:${run.id}`);
    return { actions, run_id: run.id };
  }

  await trackEvent({ eventName: "admin_test_event", userId: adminId, path: "/admin", properties: { source: "fix_common" } });
  actions.push("written_admin_test_event");

  const dictProbe = await supabaseAdmin.from("event_dictionary").select("event_name", { count: "exact", head: true }).limit(1);
  if (!dictProbe.error && (dictProbe.count ?? 0) === 0) {
    await supabaseAdmin.from("event_dictionary").upsert(eventDictionarySeedRows(), { onConflict: "event_name" });
    actions.push("event_dictionary_installed");
  }

  const eventsCount = await supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then((x) => x.count ?? 0);

  if (eventsCount === 0) {
    const devtools = await getDevtoolsStatus();
    if (devtools.enabled) {
      const seeded = await seedMinimalData();
      actions.push(`seed_minimal:${seeded.events}`);
      const run = await startSimulation({
        adminId,
        usersCount: 40,
        intervalSec: 8,
        mode: "normal",
        intensity: "normal",
      });
      actions.push(`live_started:${run.id}`);
    } else {
      actions.push(`devtools_disabled:${devtools.reason}`);
    }
  }

  return { actions };
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const result = await runAction(parsed.data.action, adminId);

    await logAdminAction({
      adminId,
      action: "fix_common_issues",
      targetType: "system",
      meta: { requested_action: parsed.data.action, ...result },
    });

    return ok({ success: true, ...result });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Forbidden", 403);
  }
}
