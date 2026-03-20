import { cookies } from "next/headers";
import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";

export async function POST() {
  const sessionId = cookies().get("meetap_session_id")?.value;
  if (sessionId) {
    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("revoked_at", null);
  }

  cookies().set("meetap_user_id", "", { path: "/", maxAge: 0 });
  cookies().set("meetap_verified", "", { path: "/", maxAge: 0 });
  cookies().set("meetap_session_id", "", { path: "/", maxAge: 0 });
  return ok({ success: true });
}
