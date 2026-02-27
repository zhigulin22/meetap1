import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const querySchema = z.object({
  event_name: z.string().trim().max(120).optional(),
  user_id: z.string().trim().max(120).optional(),
  demo_group: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      event_name: searchParams.get("event_name") ?? undefined,
      user_id: searchParams.get("user_id") ?? undefined,
      demo_group: searchParams.get("demo_group") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);
    }

    let query = supabaseAdmin
      .from("analytics_events")
      .select("id,event_name,user_id,path,properties,created_at")
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);

    if (parsed.data.event_name) query = query.eq("event_name", parsed.data.event_name);
    if (parsed.data.user_id) query = query.eq("user_id", parsed.data.user_id);
    if (parsed.data.demo_group) query = query.filter("properties->>demo_group", "eq", parsed.data.demo_group);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);

    return ok({ items: data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}
