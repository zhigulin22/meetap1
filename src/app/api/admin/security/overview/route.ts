import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();

    const [roles, blocked, sessions, actions] = await Promise.all([
      supabaseAdmin.from("users").select("role"),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("is_blocked", true),
      supabaseAdmin.from("user_sessions").select("id", { count: "exact", head: true }).is("revoked_at", null),
      supabaseAdmin.from("moderation_actions").select("id,action,reason,created_at,admin_user_id").order("created_at", { ascending: false }).limit(20),
    ]);

    let auditData: any[] = [];
    const audit = await supabaseAdmin.from("admin_audit_log").select("id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(40);
    if (!audit.error) auditData = audit.data ?? [];

    const roleCounts = new Map<string, number>();
    for (const r of roles.data ?? []) roleCounts.set(r.role ?? "user", (roleCounts.get(r.role ?? "user") ?? 0) + 1);

    return ok({
      roleCounts: Object.fromEntries(roleCounts.entries()),
      blockedUsers: blocked.count ?? 0,
      activeSessions: sessions.count ?? 0,
      recentAdminActions: actions.data ?? [],
      auditLog: auditData,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
