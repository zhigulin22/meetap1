import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst"]);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action")?.trim() || null;
    const actor = searchParams.get("actor")?.trim() || null;
    const days = Math.max(1, Math.min(90, Number(searchParams.get("days") ?? 30)));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from("admin_audit_log")
      .select("id,admin_id,action,target_type,target_id,meta,created_at")
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(500);

    if (action) query = query.eq("action", action);
    if (actor) query = query.eq("admin_id", actor);

    const auditRes = await query;
    if (auditRes.error) {
      const fallback = await supabaseAdmin
        .from("moderation_actions")
        .select("id,admin_user_id,action,target_user_id,metadata,created_at,reason")
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(500);

      if (fallback.error) return fail(fallback.error.message, 500);

      const items = (fallback.data ?? []).map((row: any) => ({
        id: row.id,
        admin_id: row.admin_user_id,
        actor_role: null,
        action_type: row.action,
        target_type: "user",
        target_id: row.target_user_id,
        reason: row.reason ?? null,
        metadata: row.metadata ?? {},
        created_at: row.created_at,
      }));

      return ok({ items, source: "moderation_actions" });
    }

    const actorIds = [...new Set((auditRes.data ?? []).map((x: any) => x.admin_id).filter(Boolean))];
    const users = actorIds.length
      ? await supabaseAdmin.from("users").select("id,role,name").in("id", actorIds)
      : { data: [] as any[] };

    const roleById = new Map<string, { role: string | null; name: string | null }>();
    for (const u of users.data ?? []) roleById.set((u as any).id, { role: (u as any).role ?? null, name: (u as any).name ?? null });

    const items = (auditRes.data ?? []).map((row: any) => ({
      id: row.id,
      admin_id: row.admin_id,
      actor_role: roleById.get(row.admin_id)?.role ?? null,
      actor_name: roleById.get(row.admin_id)?.name ?? null,
      action_type: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      reason: row.meta?.reason ?? null,
      metadata: row.meta ?? {},
      created_at: row.created_at,
    }));

    return ok({ items, source: "admin_audit_log" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
