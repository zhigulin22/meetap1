import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_review", "resolved", "rejected"]),
  ai_summary: z.string().max(800).optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok({ items: data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const { error } = await supabaseAdmin
      .from("reports")
      .update({ status: parsed.data.status, ai_summary: parsed.data.ai_summary ?? null, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);

    if (error) return fail(error.message, 500);
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
