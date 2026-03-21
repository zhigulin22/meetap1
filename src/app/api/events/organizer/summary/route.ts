import { ok, fail } from "@/lib/http";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET() {
  try {
    const userId = requireUserId();

    const schema = await getSchemaSnapshot(["event_submissions", "events"]);
    const subCols = asSet(schema, "event_submissions");
    const eventCols = asSet(schema, "events");

    let subsQuery = supabaseAdmin
      .from("event_submissions")
      .select("id,title,category,moderation_status,created_at,event_id,user_id,creator_user_id")
      .order("created_at", { ascending: false })
      .limit(12);

    if (subCols.has("creator_user_id") && subCols.has("user_id")) {
      subsQuery = subsQuery.or(`creator_user_id.eq.${userId},user_id.eq.${userId}`);
    } else if (subCols.has("creator_user_id")) {
      subsQuery = subsQuery.eq("creator_user_id", userId);
    } else if (subCols.has("user_id")) {
      subsQuery = subsQuery.eq("user_id", userId);
    }

    let eventsQuery = supabaseAdmin
      .from("events")
      .select("id,category,going_count,created_by_user_id,creator_user_id")
      .order("created_at", { ascending: false })
      .limit(200);

    if (eventCols.has("created_by_user_id")) {
      eventsQuery = eventsQuery.eq("created_by_user_id", userId);
    } else if (eventCols.has("creator_user_id")) {
      eventsQuery = eventsQuery.eq("creator_user_id", userId);
    }

    const [subs, events] = await Promise.all([subsQuery, eventsQuery]);

    if (subs.error) return fail(subs.error.message, 500);
    if (events.error) return fail(events.error.message, 500);

    const submissions = subs.data ?? [];
    const eventRows = events.data ?? [];

    const totals = {
      submissions: submissions.length,
      pending: submissions.filter((s: any) => ["pending","in_review"].includes((s as any).moderation_status)).length,
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
