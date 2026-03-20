import { cookies } from "next/headers";
import { supabaseAdmin } from "@/supabase/admin";
import { ok } from "@/lib/http";

export async function GET() {
  const cookieStore = cookies();
  const userId = cookieStore.get("meetap_user_id")?.value;

  if (!userId) return ok({ hasSession: false, hasPinSetup: false });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("pin_hash")
    .eq("id", userId)
    .maybeSingle();

  if (!user) return ok({ hasSession: false, hasPinSetup: false });

  return ok({ hasSession: true, hasPinSetup: !!user.pin_hash });
}
