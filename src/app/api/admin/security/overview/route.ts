import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { getSeedMinimalStatus } from "@/server/seed-minimal";
import { supabaseAdmin } from "@/supabase/admin";

function ratio(cur: number, prev: number) {
  if (prev <= 0) return cur > 0 ? 9 : 1;
  return cur / prev;
}

export async function GET() {
  try {
    await requireAdminUserId();

    const env = getServerEnv();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [
      roles,
      blocked,
      sessions,
      actions,
      audit,
      admins,
      events24,
      eventsPrev24,
      reports24,
      reportsPrev24,
      connect24,
      connectPrev24,
      aiErr24,
      aiErrPrev24,
    ] = await Promise.all([
      supabaseAdmin.from("users").select("role"),
      supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_blocked", true),
      supabaseAdmin
        .from("user_sessions")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null),
      supabaseAdmin
        .from("moderation_actions")
        .select("id,action,reason,created_at,admin_user_id")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("admin_audit_log")
        .select("id,action,target_type,target_id,created_at,admin_id")
        .order("created_at", { ascending: false })
        .limit(80),
      supabaseAdmin
        .from("users")
        .select("id,name,role")
        .in("role", ["admin", "moderator", "analyst", "content_manager", "support"])
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twoDaysAgo)
        .lt("created_at", dayAgo),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twoDaysAgo)
        .lt("created_at", dayAgo),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "connect_sent")
        .gte("created_at", dayAgo),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "connect_sent")
        .gte("created_at", twoDaysAgo)
        .lt("created_at", dayAgo),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "ai_error")
        .gte("created_at", dayAgo),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "ai_error")
        .gte("created_at", twoDaysAgo)
        .lt("created_at", dayAgo),
    ]);

    const roleCounts = new Map<string, number>();
    for (const r of roles.data ?? []) {
      roleCounts.set(r.role ?? "user", (roleCounts.get(r.role ?? "user") ?? 0) + 1);
    }

    const events24Count = events24.count ?? 0;
    const eventsPrev24Count = eventsPrev24.count ?? 0;
    const reports24Count = reports24.count ?? 0;
    const reportsPrev24Count = reportsPrev24.count ?? 0;
    const connect24Count = connect24.count ?? 0;
    const connectPrev24Count = connectPrev24.count ?? 0;
    const aiErr24Count = aiErr24.count ?? 0;
    const aiErrPrev24Count = aiErrPrev24.count ?? 0;

    const triggers: Array<{ key: string; level: "warning" | "critical"; message: string }> = [];

    if (events24Count === 0) {
      triggers.push({
        key: "data_missing_24h",
        level: "critical",
        message: "0 событий за последние 24ч",
      });
    }

    if (reports24Count >= 5 && ratio(reports24Count, reportsPrev24Count) >= 1.8) {
      triggers.push({
        key: "reports_spike",
        level: "warning",
        message: `Всплеск жалоб: ${reports24Count} vs ${reportsPrev24Count}`,
      });
    }

    if (connect24Count >= 50 && ratio(connect24Count, connectPrev24Count) >= 2.2) {
      triggers.push({
        key: "connect_spike",
        level: "warning",
        message: `Всплеск connect_sent: ${connect24Count} vs ${connectPrev24Count}`,
      });
    }

    if (aiErr24Count >= 3 && ratio(aiErr24Count, aiErrPrev24Count) >= 2) {
      triggers.push({
        key: "ai_error_spike",
        level: "warning",
        message: `Рост AI errors: ${aiErr24Count} vs ${aiErrPrev24Count}`,
      });
    }

    return ok({
      roleCounts: Object.fromEntries(roleCounts.entries()),
      blockedUsers: blocked.count ?? 0,
      activeSessions: sessions.count ?? 0,
      recentAdminActions: actions.data ?? [],
      auditLog: audit.data ?? [],
      admins: admins.data ?? [],
      seedMinimal: getSeedMinimalStatus(),
      apiProtection: {
        rateLimitingEnabled: true,
        csrfProtection: false,
        zodValidationCoverage: true,
        serverOnlySecrets: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      },
      dataSecurity: {
        rlsEnabledAssumed: true,
        piiMaskedInUi: true,
        logsContainSecrets: false,
      },
      threatMonitoring: {
        events24h: events24Count,
        eventsPrev24h: eventsPrev24Count,
        reports24h: reports24Count,
        reportsPrev24h: reportsPrev24Count,
        connect24h: connect24Count,
        connectPrev24h: connectPrev24Count,
        aiErrors24h: aiErr24Count,
        aiErrorsPrev24h: aiErrPrev24Count,
        triggers,
      },
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
