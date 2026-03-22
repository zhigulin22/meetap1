import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({ session_id: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const currentSessionId = cookies().get("meetap_session_id")?.value ?? null;

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const sessionId = parsed.data.session_id;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_sessions")
      .select("id,revoked_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) return fail(existingError.message, 500);
    if (!existing) return fail("Сессия не найдена", 404);

    if (!existing.revoked_at) {
      const { error: revokeError } = await supabaseAdmin
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", userId);

      if (revokeError) return fail(revokeError.message, 500);
    }

    if (currentSessionId && currentSessionId === sessionId) {
      const store = cookies();
      store.set("meetap_user_id", "", { path: "/", maxAge: 0 });
      store.set("meetap_verified", "", { path: "/", maxAge: 0 });
      store.set("meetap_session_id", "", { path: "/", maxAge: 0 });
      return ok({ success: true, signed_out: true });
    }

    return ok({ success: true, signed_out: false });
  } catch {
    return fail("Unauthorized", 401);
  }
}
