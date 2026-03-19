import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";

export async function GET() {
  try {
    const userId = requireUserId();
    const schema = await getSchemaSnapshot(["event_submissions"]);
    const cols = asSet(schema, "event_submissions");

    let query = supabaseAdmin
      .from("event_submissions")
      .select("id,title,category,city,starts_at,status,moderation_status,created_at,event_id")
      .order("created_at", { ascending: false })
      .limit(50);

    const hasCreator = cols.has("creator_user_id");
    const hasUser = cols.has("user_id");
    const hasCreatedBy = cols.has("created_by_user_id");
    const hasAuthor = cols.has("author_id");

    if (hasCreator && hasUser) {
      query = query.or(`creator_user_id.eq.${userId},user_id.eq.${userId}`);
    } else if (hasCreator) {
      query = query.eq("creator_user_id", userId);
    } else if (hasUser) {
      query = query.eq("user_id", userId);
    } else if (hasCreatedBy || hasAuthor) {
      const filters = [];
      if (hasCreatedBy) filters.push(`created_by_user_id.eq.${userId}`);
      if (hasAuthor) filters.push(`author_id.eq.${userId}`);
      if (filters.length) query = query.or(filters.join(","));
      else return ok({ items: [] });
    } else {
      return ok({ items: [] });
    }

    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok({ items: data ?? [] });
  } catch {
    return fail("Unauthorized", 401);
  }
}
