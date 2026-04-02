import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";

type MemberUser = { id: string; name: string; avatar_url: string | null; interests: string[] | null };
type MemberRow = { user_id: string; users: MemberUser | MemberUser[] | null };

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();

    const { data: me } = await supabaseAdmin
      .from("users")
      .select("interests")
      .eq("id", userId)
      .single();

    const myInterests = ((me?.interests ?? []) as string[]);

    const { data: membersRaw } = await supabaseAdmin
      .from("event_members")
      .select("user_id,users(id,name,avatar_url,interests)")
      .eq("event_id", params.id);

    const members = (membersRaw ?? []) as MemberRow[];

    const picks = members
      .map((m: MemberRow) => {
        const user = Array.isArray(m.users) ? m.users[0] : m.users;
        if (!user || user.id === userId) return null;
        const interests = (user.interests ?? []) as string[];
        const common = interests.filter((x: string) => myInterests.includes(x));
        return { ...user, score: common.length, common };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
      .slice(0, 3);

    return ok({ items: picks });
  } catch {
    return fail("Unauthorized", 401);
  }
}
