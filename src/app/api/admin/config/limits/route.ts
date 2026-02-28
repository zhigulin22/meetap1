import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { supabaseAdmin } from "@/supabase/admin";

const defaultLimits = {
  connect_daily_limit: 10,
  message_rate_limit: 30,
  event_join_limit: 20,
  spam_connect_threshold: 30,
  spam_message_threshold: 40,
};

const schema = z.object({
  connect_daily_limit: z.number().int().min(1).max(200).optional(),
  message_rate_limit: z.number().int().min(1).max(500).optional(),
  event_join_limit: z.number().int().min(1).max(200).optional(),
  spam_connect_threshold: z.number().int().min(1).max(500).optional(),
  spam_message_threshold: z.number().int().min(1).max(500).optional(),
  reason: z.string().trim().min(2).max(240).optional(),
});

async function getLimits() {
  const q = await supabaseAdmin.from("system_settings").select("value").eq("key", "limits_rules").maybeSingle();
  if (q.error || !q.data?.value || typeof q.data.value !== "object") return defaultLimits;
  return { ...defaultLimits, ...(q.data.value as Record<string, number>) };
}

export async function GET() {
  try {
    await requireAdminUserId(["admin", "moderator", "analyst"]);
    const limits = await getLimits();
    return ok({ limits });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const current = await getLimits();
    const next = {
      ...current,
      ...Object.fromEntries(Object.entries(parsed.data).filter(([k, v]) => k !== "reason" && v !== undefined)),
    };

    const upsert = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: "limits_rules", value: next, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (upsert.error) return fail(upsert.error.message, 500);

    await logAdminAction({
      adminId,
      action: "limits_update",
      targetType: "system",
      targetId: "limits_rules",
      meta: { before: current, after: next, reason: parsed.data.reason ?? null },
    });

    return ok({ success: true, limits: next });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
