import { fail, ok } from "@/lib/http";
import { userSearchSchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = userSearchSchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit") ?? 30,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    const { q, limit } = parsed.data;

    let query = supabaseAdmin
      .from("users")
      .select("id,name,phone,telegram_user_id,role,is_blocked,shadow_banned,message_limited,blocked_reason,blocked_until,created_at,last_post_at,telegram_verified,profile_completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRe.test(q)) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,id.eq.${q},telegram_user_id.eq.${q}`);
      } else {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,telegram_user_id.eq.${q}`);
      }
    }

    const { data: users, error } = await query;
    if (error) return fail(error.message, 500);

    const userIds = (users ?? []).map((u) => u.id);

    const [flags, reports, events] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("content_flags").select("user_id,status").in("user_id", userIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; status: string }> }),
      userIds.length
        ? supabaseAdmin.from("reports").select("target_user_id,status").in("target_user_id", userIds)
        : Promise.resolve({ data: [] as Array<{ target_user_id: string; status: string }> }),
      userIds.length
        ? supabaseAdmin.from("analytics_events").select("user_id,event_name,created_at").in("user_id", userIds).limit(10000)
        : Promise.resolve({ data: [] as Array<{ user_id: string; event_name: string; created_at: string }> }),
    ]);

    const flagsMap = new Map<string, number>();
    for (const row of flags.data ?? []) {
      if (row.status !== "open") continue;
      if (!row.user_id) continue;
      flagsMap.set(row.user_id, (flagsMap.get(row.user_id) ?? 0) + 1);
    }

    const reportsMap = new Map<string, number>();
    for (const row of reports.data ?? []) {
      if (row.status !== "open") continue;
      if (!row.target_user_id) continue;
      reportsMap.set(row.target_user_id, (reportsMap.get(row.target_user_id) ?? 0) + 1);
    }

    const lastSeenMap = new Map<string, string>();
    for (const ev of events.data ?? []) {
      const prev = lastSeenMap.get(ev.user_id);
      if (!prev || ev.created_at > prev) {
        lastSeenMap.set(ev.user_id, ev.created_at);
      }
    }

    return ok({
      items: (users ?? []).map((u) => ({
        ...u,
        openFlags: flagsMap.get(u.id) ?? 0,
        openReports: reportsMap.get(u.id) ?? 0,
        lastSeenAt: lastSeenMap.get(u.id) ?? null,
      })),
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
