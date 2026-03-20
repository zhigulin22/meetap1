import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getCurrentUserId } from "@/server/auth";

export async function GET() {
  const userId = getCurrentUserId();

  const [{ data: events }, { data: members }, { data: myMemberships }] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id,title,description,outcomes,cover_url,event_date,price,city")
      .order("event_date", { ascending: true }),
    supabaseAdmin.from("event_members").select("event_id,user_id,users(id,name,avatar_url)"),
    userId
      ? supabaseAdmin.from("event_members").select("event_id").eq("user_id", userId)
      : Promise.resolve({ data: [] as Array<{ event_id: string }> }),
  ]);

  const joinedSet = new Set((myMemberships ?? []).map((x) => x.event_id));

  const grouped = new Map<string, Array<{ id: string; name: string; avatar_url: string | null }>>();

  for (const m of members ?? []) {
    const existing = grouped.get(m.event_id) ?? [];
    const user = Array.isArray(m.users) ? m.users[0] : m.users;
    if (user) {
      existing.push(user as { id: string; name: string; avatar_url: string | null });
      grouped.set(m.event_id, existing);
    }
  }

  return ok({
    items: (events ?? []).map((e) => ({
      ...e,
      participants: (grouped.get(e.id) ?? []).slice(0, 5),
      joined: joinedSet.has(e.id),
    })),
  });
}
