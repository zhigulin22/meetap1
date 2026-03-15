import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const upsertSchema = z.object({
  key: z.string().min(2).max(80),
  value: z.record(z.unknown()),
});

export async function GET() {
  try {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin.from("system_settings").select("*").order("key", { ascending: true });
    if (error) {
      if (error.message.toLowerCase().includes("system_settings")) return ok({ items: [] });
      return fail(error.message, 500);
    }
    return ok({ items: data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    const adminUserId = await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: parsed.data.key, value: parsed.data.value, updated_by: adminUserId, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      if (error.message.toLowerCase().includes("system_settings")) return fail("Apply migration 009 for system settings", 500);
      return fail(error.message, 500);
    }
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
