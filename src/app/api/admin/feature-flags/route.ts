import { featureFlagUpsertSchema } from "@/lib/admin-schemas";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";
import { z } from "zod";

const remoteConfigSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.literal("config"),
  key: z.string().min(2).max(120),
  value: z.record(z.unknown()),
  description: z.string().max(300).optional(),
});

export async function GET() {
  try {
    await requireAdminUserId();

    const [flags, configs] = await Promise.all([
      supabaseAdmin.from("feature_flags").select("id,key,description,enabled,rollout,scope,payload,updated_at").order("key", { ascending: true }),
      supabaseAdmin.from("remote_configs").select("id,key,value,description,updated_at").order("key", { ascending: true }),
    ]);

    return ok({ flags: flags.data ?? [], configs: configs.data ?? [] });
  } catch {
    return fail("Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const adminUserId = await requireAdminUserId();

    const body = await req.json().catch(() => null);

    const asConfig = remoteConfigSchema.safeParse(body);
    if (asConfig.success) {
      const payload = {
        key: asConfig.data.key,
        value: asConfig.data.value,
        description: asConfig.data.description ?? null,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      };

      if (asConfig.data.id) {
        const { error } = await supabaseAdmin.from("remote_configs").update(payload).eq("id", asConfig.data.id);
        if (error) return fail(error.message, 500);
      } else {
        const { error } = await supabaseAdmin.from("remote_configs").upsert(payload, { onConflict: "key" });
        if (error) return fail(error.message, 500);
      }

      await supabaseAdmin.from("moderation_actions").insert({
        admin_user_id: adminUserId,
        target_user_id: null,
        action: "remote_config_upsert",
        reason: asConfig.data.key,
        metadata: payload,
      });

      return ok({ success: true });
    }

    const parsed = featureFlagUpsertSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const payload = {
      key: parsed.data.key,
      description: parsed.data.description ?? null,
      enabled: parsed.data.enabled,
      rollout: parsed.data.rollout,
      scope: parsed.data.scope,
      payload: parsed.data.payload ?? {},
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.id) {
      const { error } = await supabaseAdmin.from("feature_flags").update(payload).eq("id", parsed.data.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabaseAdmin.from("feature_flags").upsert(payload, { onConflict: "key" });
      if (error) return fail(error.message, 500);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      admin_user_id: adminUserId,
      target_user_id: null,
      action: "feature_flag_upsert",
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
    const kind = searchParams.get("kind") ?? "flag";
    if (!id) return fail("id required", 422);

    if (kind === "config") {
      const { error } = await supabaseAdmin.from("remote_configs").delete().eq("id", id);
      if (error) return fail(error.message, 500);
      return ok({ success: true });
    }

    const { error } = await supabaseAdmin.from("feature_flags").delete().eq("id", id);
    if (error) return fail(error.message, 500);

    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
