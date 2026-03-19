import { cookies } from "next/headers";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function DELETE() {
  try {
    const userId = requireUserId();

    await supabaseAdmin
      .from("users")
      .update({
        deleted_at: new Date().toISOString(),
        is_blocked: true,
        blocked_reason: "self_deleted",
        blocked_until: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", userId);

    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);

    const store = cookies();
    store.set("meetap_user_id", "", { path: "/", maxAge: 0 });
    store.set("meetap_verified", "", { path: "/", maxAge: 0 });
    store.set("meetap_session_id", "", { path: "/", maxAge: 0 });

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
