import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { buildIcebreaker } from "@/server/ai";

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const targetUserId = String(body?.targetUserId ?? "");
    const context = String(body?.context ?? "").slice(0, 300);

    if (!targetUserId || targetUserId === userId) {
      return fail("Invalid target user", 422);
    }

    const [{ data: me }, { data: target }] = await Promise.all([
      supabaseAdmin.from("users").select("id,name,interests").eq("id", userId).single(),
      supabaseAdmin.from("users").select("id,name,interests").eq("id", targetUserId).single(),
    ]);

    if (!me || !target) {
      return fail("Users not found", 404);
    }

    const myInterests = (me.interests ?? []) as string[];
    const targetInterests = (target.interests ?? []) as string[];

    const common = myInterests.filter((i) => targetInterests.includes(i));

    const ice = await buildIcebreaker({
      user1: { name: me.name, interests: myInterests },
      user2: { name: target.name, interests: targetInterests },
      context: context || `Общие интересы: ${common.join(", ") || "нет"}`,
    });

    await supabaseAdmin.from("connections").insert({
      from_user_id: userId,
      to_user_id: targetUserId,
      status: "pending",
    });

    return ok({
      success: true,
      common,
      icebreaker: ice,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
