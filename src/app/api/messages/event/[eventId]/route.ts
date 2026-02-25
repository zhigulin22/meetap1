import { NextRequest } from "next/server";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { fail, ok } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const me = requireUserId();

    const { data: msgs, error } = await supabaseAdmin
      .from("messages")
      .select("id, from_user_id, content, created_at")
      .eq("event_id", params.eventId)
      .is("to_user_id", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) return fail(error.message);

    const uids = [...new Set((msgs ?? []).map((m: any) => m.from_user_id))];
    const { data: users } = uids.length
      ? await supabaseAdmin.from("users").select("id, name, avatar_url").in("id", uids)
      : { data: [] };

    const umap = new Map((users ?? []).map((u: any) => [u.id, u]));
    const messages = (msgs ?? []).map((m: any) => ({
      ...m,
      user: umap.get(m.from_user_id) ?? { id: m.from_user_id, name: "...", avatar_url: null },
    }));

    return ok({ messages, myId: me });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const me = requireUserId();
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000) return fail("Invalid message", 422);

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ from_user_id: me, event_id: params.eventId, content, to_user_id: null })
      .select("id, from_user_id, content, created_at")
      .single();

    if (error) return fail(error.message);
    return ok({ message: data });
  } catch {
    return fail("Unauthorized", 401);
  }
}
