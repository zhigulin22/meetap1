import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const querySchema = z.object({
  event_name: z.string().trim().max(120).optional(),
  user_id: z.string().trim().max(120).optional(),
  demo_group: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

function summarizeProperties(input: Record<string, unknown> | null | undefined) {
  if (!input) return "-";
  const keys = ["demo_group", "event_id", "city", "reason", "run_id", "chaos", "message_hash"];
  const chunks: string[] = [];
  for (const key of keys) {
    if (input[key] === undefined || input[key] === null || input[key] === "") continue;
    chunks.push(`${key}:${String(input[key])}`);
  }
  if (!chunks.length) {
    const fallback = Object.entries(input).slice(0, 3).map(([k, v]) => `${k}:${String(v)}`);
    return fallback.join(" | ") || "-";
  }
  return chunks.join(" | ");
}

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

    return ok({
      items: (data ?? []).map((row: any) => ({
        ...row,
        summary: summarizeProperties(row.properties as Record<string, unknown> | null),
      })),
    });
  } catch (error) {
    return adminRouteError("/api/admin/events/live", error);
  }
}
