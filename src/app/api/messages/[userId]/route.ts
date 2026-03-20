import { NextRequest } from "next/server";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { fail, ok } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const me = requireUserId();
    const other = params.userId;

    const [{ data: msgs, error }, { data: user }] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("id, from_user_id, to_user_id, content, created_at")
        .or(
          `and(from_user_id.eq.${me},to_user_id.eq.${other}),and(from_user_id.eq.${other},to_user_id.eq.${me})`,
        )
        .is("event_id", null)
        .order("created_at", { ascending: true })
        .limit(200),
      supabaseAdmin.from("users").select("id, name, avatar_url").eq("id", other).single(),
    ]);

    if (error) return fail(error.message);
    return ok({ messages: msgs ?? [], user, myId: me });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const me = requireUserId();
    const other = params.userId;
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000) return fail("Invalid message", 422);

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ from_user_id: me, to_user_id: other, content, event_id: null })
      .select("id, from_user_id, to_user_id, content, created_at")
      .single();

    if (error) return fail(error.message);
    return ok({ message: data });
  } catch {
    return fail("Unauthorized", 401);
  }
}
