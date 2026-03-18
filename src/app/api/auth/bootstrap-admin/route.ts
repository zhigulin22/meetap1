import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { isBootstrapAdminPhone } from "@/server/admin-bootstrap";
import { supabaseAdmin } from "@/supabase/admin";

export async function POST() {
  try {
    const userId = requireUserId();

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id,phone,role")
      .eq("id", userId)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!user?.id) return fail("User not found", 404);

    if (user.role === "admin" || user.role === "super_admin") {
      return ok({ success: true, role: user.role, updated: false });
    }

    if (!isBootstrapAdminPhone(user.phone)) {
      return fail("Not allowed for this account", 403);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ role: "admin" })
      .eq("id", userId)
      .select("id,role")
      .single();

    if (updateError) return fail(updateError.message, 500);

    return ok({ success: true, role: updated.role, updated: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
