import { cookies } from "next/headers";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    const userId = requireUserId();

    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .select("id,device_label,created_at,last_active_at,revoked_at")
      .eq("user_id", userId)
      .order("last_active_at", { ascending: false })
      .limit(15);

    if (error) {
      if (error.message.toLowerCase().includes("user_sessions")) {
        return fail("Не применена миграция user_sessions", 500);
      }
      return fail(error.message, 500);
    }

    return ok({ items: data ?? [] });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST() {
  try {
    const userId = requireUserId();

    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);

    cookies().set("meetap_user_id", "", { path: "/", maxAge: 0 });
    cookies().set("meetap_verified", "", { path: "/", maxAge: 0 });
    cookies().set("meetap_session_id", "", { path: "/", maxAge: 0 });

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
