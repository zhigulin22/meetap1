import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { requireAdminUserId } from "@/server/admin";
import { DEFAULT_HELP_TEXTS, type HelpTexts } from "@/lib/admin-help-texts";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  await requireAdminUserId(["super_admin", "admin", "moderator", "analyst", "support"]);

  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("key,value")
      .in("key", ["help_texts", "admin_help_texts_v1"])
      .limit(2);

    if (error) {
      if (String(error.message).toLowerCase().includes("system_settings")) {
        return ok({ source: "fallback", texts: DEFAULT_HELP_TEXTS });
      }
      return ok({ source: "fallback", warning: error.message, texts: DEFAULT_HELP_TEXTS });
    }

    const fromSettings = ((data ?? []).find((x: any) => x.key === "help_texts")?.value ??
      (data ?? []).find((x: any) => x.key === "admin_help_texts_v1")?.value ??
      {}) as HelpTexts;

    return ok({
      source: Object.keys(fromSettings).length ? "system_settings" : "fallback",
      texts: {
        ...DEFAULT_HELP_TEXTS,
        ...fromSettings,
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
