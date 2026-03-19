import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().min(2).max(40),
  metric: z.string().min(2).max(80),
  threshold: z.number(),
  window_days: z.number().int().min(1).max(90).default(7),
  status: z.enum(["active", "paused", "triggered"]).default("active"),
});

export async function GET() {
  try {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin.from("alerts").select("*").order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);

    const items = (data ?? []).map((row: any) => {
      const alertWindow = row.alert_window ?? row.window ?? "7";
      const parsedDays = Number(String(alertWindow).replace(/[^0-9]/g, ""));
      return {
        ...row,
        window: `${Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7}d`,
        window_days: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7,
      };
    });

    return ok({ items });
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

    const payload = {
      id: parsed.data.id,
      type: parsed.data.type,
      metric: parsed.data.metric,
      threshold: parsed.data.threshold,
      alert_window: String(parsed.data.window_days),
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.id) {
      const { error } = await supabaseAdmin.from("alerts").update(payload).eq("id", parsed.data.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabaseAdmin.from("alerts").insert(payload);
      if (error) return fail(error.message, 500);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminUserId,
      target_user_id: null,
      action: "alert_upsert",
      reason: `Alert ${parsed.data.metric}`,
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
    const { error } = await supabaseAdmin.from("alerts").delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
