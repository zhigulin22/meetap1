import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(2).max(80),
  variants: z.record(z.unknown()).default({}),
  rollout_percent: z.number().int().min(0).max(100).default(0),
  start_at: z.string().datetime().optional().nullable(),
  end_at: z.string().datetime().optional().nullable(),
  primary_metric: z.string().max(80).optional().nullable(),
  status: z.enum(["draft", "running", "paused", "completed"]).default("draft"),
});

export async function GET() {
  try {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin.from("experiments").select("*").order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return ok({ items: data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminUserId = await requireAdminUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const payload = { ...parsed.data, updated_at: new Date().toISOString() };
    if (parsed.data.id) {
      const { error } = await supabaseAdmin.from("experiments").update(payload).eq("id", parsed.data.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabaseAdmin.from("experiments").insert(payload);
      if (error) return fail(error.message, 500);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminUserId,
      target_user_id: null,
      action: "experiment_upsert",
      reason: parsed.data.key,
      metadata: payload,
    });

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
    const { error } = await supabaseAdmin.from("experiments").delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
