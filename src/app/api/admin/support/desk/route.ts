import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getSchemaSnapshot } from "@/server/schema-introspect";
import { listSupportNotes, listSupportTickets } from "@/server/support-store";
import { supabaseAdmin } from "@/supabase/admin";

function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const p = String(phone);
  if (p.length <= 4) return "****";
  return `${p.slice(0, 2)}***${p.slice(-2)}`;
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "support"]);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const userId = (searchParams.get("user_id") ?? "").trim();

    const schema = await getSchemaSnapshot(["users"]);
    const usersCols = new Set(schema.users ?? []);

    const selectCols = ["id", "name", "username", "email", "phone", "city", "profile_completed", "shadow_banned", "message_limited", "created_at", "is_demo", "demo_group"].filter((c) => usersCols.has(c));
    if (!selectCols.includes("id")) selectCols.unshift("id");

    let usersQuery = supabaseAdmin.from("users").select(selectCols.join(",")).order("created_at", { ascending: false }).limit(50);

    if (q) {
      const filters: string[] = [];
      if (usersCols.has("username")) filters.push(`username.ilike.%${q}%`);
      if (usersCols.has("email")) filters.push(`email.ilike.%${q}%`);
      if (usersCols.has("name")) filters.push(`name.ilike.%${q}%`);
      if (usersCols.has("phone")) filters.push(`phone.ilike.%${q}%`);
      if (filters.length) usersQuery = usersQuery.or(filters.join(","));
    }

    if (userId) usersQuery = usersQuery.eq("id", userId);

    const usersRes = await usersQuery;
    if (usersRes.error) return fail(usersRes.error.message, 500);

    const ids = (usersRes.data ?? []).map((x: any) => x.id).filter(Boolean);

    const activityByUser = new Map<string, { last_active_at: string | null; events_7d: number; events_30d: number }>();
    if (ids.length) {
      const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const ev = await supabaseAdmin
        .from("analytics_events")
        .select("user_id,created_at")
        .in("user_id", ids)
        .gte("created_at", d30)
        .order("created_at", { ascending: false })
        .limit(40000);

      for (const id of ids) activityByUser.set(id, { last_active_at: null, events_7d: 0, events_30d: 0 });
      for (const row of ev.data ?? []) {
        const id = (row as any).user_id;
        if (!id || !activityByUser.has(id)) continue;
        const item = activityByUser.get(id)!;
        const ts = (row as any).created_at as string;
        if (!item.last_active_at) item.last_active_at = ts;
        item.events_30d += 1;
        if (ts >= d7) item.events_7d += 1;
      }
    }

    const users = (usersRes.data ?? []).map((u: any) => ({
      ...u,
      phone_masked: maskPhone(u.phone),
      last_active_at: activityByUser.get(u.id)?.last_active_at ?? null,
      events_7d: activityByUser.get(u.id)?.events_7d ?? 0,
      events_30d: activityByUser.get(u.id)?.events_30d ?? 0,
    }));

    const [notes, tickets] = await Promise.all([
      listSupportNotes(userId || undefined),
      listSupportTickets(userId || undefined),
    ]);

    return ok({ users, notes: notes.slice(0, 200), tickets: tickets.slice(0, 200) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
