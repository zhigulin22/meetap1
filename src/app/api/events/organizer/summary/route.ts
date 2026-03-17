import { ok, fail } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    const userId = requireUserId();

    const [subs, events] = await Promise.all([
      supabaseAdmin
        .from("event_submissions")
        .select("id,title,category,moderation_status,created_at,event_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("events")
        .select("id,category,going_count,created_by_user_id")
        .eq("created_by_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (subs.error) return fail(subs.error.message, 500);
    if (events.error) return fail(events.error.message, 500);

    const submissions = subs.data ?? [];
    const eventRows = events.data ?? [];

    const totals = {
      submissions: submissions.length,
      pending: submissions.filter((s: any) => (s as any).moderation_status === "pending").length,
      approved: submissions.filter((s: any) => (s as any).moderation_status === "approved").length,
      rejected: submissions.filter((s: any) => (s as any).moderation_status === "rejected").length,
    };

    const byCategory: Record<string, number> = {};
    let totalAttendees = 0;
    for (const ev of eventRows) {
      const cat = (ev as any).category || "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      totalAttendees += Number((ev as any).going_count ?? 0);
    }

    return ok({
      totals,
      events: {
        count: eventRows.length,
        total_attendees: totalAttendees,
        by_category: byCategory,
      },
      recent: submissions,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}
