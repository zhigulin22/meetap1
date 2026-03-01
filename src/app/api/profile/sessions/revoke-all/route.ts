import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { cookies } from "next/headers";

const schema = z
  .object({
    except_current: z.boolean().default(true),
  })
  .partial();

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const currentSessionId = cookies().get("meetap_session_id")?.value ?? null;

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const exceptCurrent = parsed.data.except_current ?? true;

    let query = supabaseAdmin.from("user_sessions").select("id").eq("user_id", userId).is("revoked_at", null);
    if (exceptCurrent && currentSessionId) {
      query = query.neq("id", currentSessionId);
    }

    const { data: sessions, error: listError } = await query;
    if (listError) return fail(listError.message, 500);

    const ids = (sessions ?? []).map((x: { id: string }) => x.id);
    if (!ids.length) return ok({ success: true, revoked_count: 0 });

    const { error: revokeError } = await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .in("id", ids)
      .eq("user_id", userId);

    if (revokeError) return fail(revokeError.message, 500);

    return ok({ success: true, revoked_count: ids.length });
  } catch {
    return fail("Unauthorized", 401);
  }
}
