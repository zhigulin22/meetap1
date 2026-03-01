import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { requireAdminUserId } from "@/server/admin";
import { DEFAULT_HELP_TEXTS, type HelpTexts } from "@/lib/admin-help-texts";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  await requireAdminUserId(["admin", "moderator", "analyst", "support"]);

  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("key,value")
      .eq("key", "admin_help_texts_v1")
      .maybeSingle();

    if (error) {
      if (String(error.message).toLowerCase().includes("system_settings")) {
        return ok({ source: "fallback", texts: DEFAULT_HELP_TEXTS });
      }
      return ok({ source: "fallback", warning: error.message, texts: DEFAULT_HELP_TEXTS });
    }

    const dynamic = (data?.value ?? {}) as HelpTexts;
    return ok({
      source: data ? "system_settings" : "fallback",
      texts: {
        ...DEFAULT_HELP_TEXTS,
        ...dynamic,
      },
    });
  } catch (error) {
    return ok({
      source: "fallback",
      warning: error instanceof Error ? error.message : "unknown",
      texts: DEFAULT_HELP_TEXTS,
    });
  }
}
