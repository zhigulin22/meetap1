import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";

type ContactUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  interests: string[] | null;
  level?: number;
};
type ContactGroup = { id: string; title: string; city: string; event_date: string };

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId();
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";

    const [{ data: meRaw }, { data: usersRaw }, { data: eventsRaw }] = await Promise.all([
      supabaseAdmin.from("users").select("id,name,interests").eq("id", userId).single(),
      supabaseAdmin
        .from("users")
        .select("id,name,avatar_url,interests,level")
        .neq("id", userId)
        .limit(60),
      supabaseAdmin.from("events").select("id,title,city,event_date").limit(20),
    ]);

    const me = meRaw as { interests: string[] | null } | null;
    const myInterests = me?.interests ?? [];

    const users = (usersRaw ?? []) as ContactUser[];
    const events = (eventsRaw ?? []) as ContactGroup[];

    const filteredPeople = users.filter((u: ContactUser) =>
      q
        ? u.name.toLowerCase().includes(q) ||
          (u.interests ?? []).some((i: string) => i.toLowerCase().includes(q))
        : true,
    );

    const people = filteredPeople.map((u: any) => {
      const interests = u.interests ?? [];
      const common = interests.filter((x: any) => myInterests.includes(x));
      const compatibility = Math.min(95, 35 + common.length * 18 + (u.level ?? 1) * 2);

      return {
        ...u,
        common,
        compatibility,
        reason:
          common.length > 0
            ? `Совпадения: ${common.slice(0, 3).join(", ")}`
            : "Похоже по ритму и стилю общения",
      };
    });

    const groups = events.filter((e: ContactGroup) =>
      q ? e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) : true,
    );

    const hotMatches = [...people]
      .sort((a: any, b: any) => b.compatibility - a.compatibility)
      .slice(0, 6);

    return ok({ people, groups, hotMatches });
  } catch {
    return fail("Unauthorized", 401);
  }
}
