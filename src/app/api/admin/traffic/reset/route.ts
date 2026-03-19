import { ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { trackEvent } from "@/server/analytics";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

export async function POST() {
  try {
    const adminId = await requireAdminUserId(["admin"]);

    const schema = await getSchemaSnapshot(["users", "events", "posts", "connections", "messages", "reports", "event_members", "analytics_events"]);
    const usersCols = asSet(schema, "users");
    const eventsCols = asSet(schema, "events");
    const postsCols = asSet(schema, "posts");
    const connectionsCols = asSet(schema, "connections");
    const messagesCols = asSet(schema, "messages");
    const reportsCols = asSet(schema, "reports");
    const eventMembersCols = asSet(schema, "event_members");

    const deleted: Record<string, number> = {};

    if (usersCols.has("is_demo") && usersCols.has("demo_group")) {
      const q = await supabaseAdmin.from("users").delete({ count: "exact" }).eq("is_demo", true).eq("demo_group", "traffic");
      if (q.error) throw new Error(q.error.message);
      deleted.users = q.count ?? 0;
    }

    if (eventsCols.has("is_demo") && eventsCols.has("demo_group")) {
      const q = await supabaseAdmin.from("events").delete({ count: "exact" }).eq("is_demo", true).eq("demo_group", "traffic");
      if (q.error) throw new Error(q.error.message);
      deleted.events = q.count ?? 0;
    }

    if (postsCols.has("is_demo") && postsCols.has("demo_group")) {
      const q = await supabaseAdmin.from("posts").delete({ count: "exact" }).eq("is_demo", true).eq("demo_group", "traffic");
      if (q.error) throw new Error(q.error.message);
      deleted.posts = q.count ?? 0;
    }

    if (connectionsCols.has("is_demo") && connectionsCols.has("demo_group")) {
      const q = await supabaseAdmin.from("connections").delete({ count: "exact" }).eq("is_demo", true).eq("demo_group", "traffic");
      if (q.error) throw new Error(q.error.message);
      deleted.connections = q.count ?? 0;
    }

    if (messagesCols.has("is_demo") && messagesCols.has("demo_group")) {
      const q = await supabaseAdmin.from("messages").delete({ count: "exact" }).eq("is_demo", true).eq("demo_group", "traffic");
      if (q.error) throw new Error(q.error.message);
      deleted.messages = q.count ?? 0;
    }

    if (reportsCols.has("details")) {
      const q = await supabaseAdmin.from("reports").delete({ count: "exact" }).ilike("details", "%traffic generator demo report%");
      if (q.error) throw new Error(q.error.message);
      deleted.reports = q.count ?? 0;
    }

    if (eventMembersCols.has("event_id")) {
      const eventIds = await supabaseAdmin.from("events").select("id").eq("is_demo", true).eq("demo_group", "traffic").limit(10000);
      const ids = (eventIds.data ?? []).map((x: any) => x.id).filter(Boolean);
      if (ids.length) {
        const q = await supabaseAdmin.from("event_members").delete({ count: "exact" }).in("event_id", ids);
        if (q.error) throw new Error(q.error.message);
        deleted.event_members = q.count ?? 0;
      }
    }

    const analytics = await supabaseAdmin
      .from("analytics_events")
      .delete({ count: "exact" })
      .filter("properties->>demo_group", "eq", "traffic");
    if (analytics.error) throw new Error(analytics.error.message);
    deleted.analytics_events = analytics.count ?? 0;

    await logAdminAction({
      adminId,
      action: "traffic_reset_demo",
      targetType: "traffic",
      targetId: null,
      meta: deleted,
    });

    await trackEvent({
      eventName: "admin_action",
      userId: adminId,
      path: "/admin",
      properties: { action: "traffic_reset_demo", deleted },
    });

    return ok({ ok: true, deleted });
  } catch (error) {
    return adminRouteError("/api/admin/traffic/reset", error);
  }
}
