import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    await requireAdminUserId();
    const env = getServerEnv();

    const [apiErrors, aiErrors, tgErrors] = await Promise.all([
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "api_error").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "ai_error").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "telegram_verify_error").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return ok({
      items: [
        { key: "supabase", status: "ok", configured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) },
        { key: "telegram", status: env.TELEGRAM_BOT_TOKEN ? "ok" : "missing", configured: Boolean(env.TELEGRAM_BOT_TOKEN), errors7d: tgErrors.count ?? 0 },
        { key: "openai", status: env.OPENAI_API_KEY ? "ok" : "missing", configured: Boolean(env.OPENAI_API_KEY), errors7d: aiErrors.count ?? 0 },
      ],
      apiErrors7d: apiErrors.count ?? 0,
    });
  } catch {
    return fail("Forbidden", 403);
  }
}
