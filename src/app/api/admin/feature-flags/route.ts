import { featureFlagUpsertSchema } from "@/lib/admin-schemas";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { supabaseAdmin } from "@/supabase/admin";

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

    const { error } = await supabaseAdmin.from("feature_flags").delete().eq("id", id);
    if (error) return fail(error.message, 500);

    return ok({ success: true });
  } catch {
    return fail("Forbidden", 403);
  }
}
