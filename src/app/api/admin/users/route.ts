import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireAdminUserId } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    let query = supabaseAdmin
      .from("users")
      .select("id,name,phone,role,is_blocked,blocked_reason,blocked_until,created_at,last_post_at")
      .order("created_at", { ascending: false })
      .limit(60);

    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data: users, error } = await query;
    if (error) return fail(error.message, 500);

    const userIds = (users ?? []).map((u) => u.id);
    let flagsMap = new Map<string, number>();

    if (userIds.length) {
      const { data: flags } = await supabaseAdmin.from("user_flags").select("user_id,status").in("user_id", userIds);
      flagsMap = new Map<string, number>();
      for (const f of flags ?? []) {
        if (f.status === "open") {
          flagsMap.set(f.user_id, (flagsMap.get(f.user_id) ?? 0) + 1);
        }
      }
    }

    return ok({
      items: (users ?? []).map((u) => ({
        ...u,
        open_flags: flagsMap.get(u.id) ?? 0,
      })),
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
