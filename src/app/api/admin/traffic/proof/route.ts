import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const querySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(30).default(2),
  demo_group: z.string().trim().min(1).max(80).default("traffic"),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      minutes: searchParams.get("minutes") ?? undefined,
      demo_group: searchParams.get("demo_group") ?? "traffic",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const since = new Date(Date.now() - parsed.data.minutes * 60 * 1000).toISOString();

    const [countRes, lastRes] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .filter("properties->>demo_group", "eq", parsed.data.demo_group)
        .gte("created_at", since),
      supabaseAdmin
        .from("analytics_events")
        .select("created_at")
        .filter("properties->>demo_group", "eq", parsed.data.demo_group)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    return ok({
      minutes: parsed.data.minutes,
      demo_group: parsed.data.demo_group,
      events_last_window: countRes.count ?? 0,
      last_event_at: lastRes.data?.[0]?.created_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message === "Forbidden") return fail("Forbidden", 403);
    return fail(message, 400);
  }
}
