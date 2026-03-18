import { supabaseAdmin } from "@/supabase/admin";

export async function logAdminAction(input: {
  adminId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: input.adminId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // no-op
  }
}
