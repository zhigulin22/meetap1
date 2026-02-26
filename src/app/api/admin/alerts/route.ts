import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().min(2).max(40),
  metric: z.string().min(2).max(80),
  threshold: z.number(),
  window: z.string().min(2).max(40),
  status: z.enum(["active", "paused", "triggered"]).default("active"),
});

export async function GET() {
  try {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin.from("alerts").select("*").order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return ok({ items: data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const payload = { ...parsed.data, updated_at: new Date().toISOString() };
    if (parsed.data.id) {
      const { error } = await supabaseAdmin.from("alerts").update(payload).eq("id", parsed.data.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabaseAdmin.from("alerts").insert(payload);
      if (error) return fail(error.message, 500);
    }

    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdminUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("id required", 422);
    const { error } = await supabaseAdmin.from("alerts").delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
