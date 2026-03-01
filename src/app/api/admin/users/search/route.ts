import { fail, ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { userSearchSchema } from "@/lib/admin-schemas";
import { requireAdminUserId } from "@/server/admin";
import { canonicalizeEventName } from "@/server/event-dictionary";
import { buildRiskProfiles } from "@/server/risk";
import { asSet, getSchemaSnapshot } from "@/server/schema-introspect";
import { supabaseAdmin } from "@/supabase/admin";

type DemoFilter = "all" | "demo" | "real" | "traffic";
type UserSort = "created_desc" | "activity_7d" | "reports_7d" | "connect_sent_7d" | "reply_rate" | "risk_score";

function applySearch(query: any, q: string, limit: number, cols: Set<string>) {
  let next = query.limit(limit);
  if (cols.has("created_at")) next = next.order("created_at", { ascending: false });
  if (!q) return next;

  const searchChunks: string[] = [];
  if (cols.has("name")) searchChunks.push(`name.ilike.%${q}%`);
  if (cols.has("username")) searchChunks.push(`username.ilike.%${q}%`);
  if (cols.has("email")) searchChunks.push(`email.ilike.%${q}%`);
  if (cols.has("phone")) searchChunks.push(`phone.ilike.%${q}%`);
  if (cols.has("telegram_user_id")) searchChunks.push(`telegram_user_id.eq.${q}`);
  if (cols.has("city")) searchChunks.push(`city.ilike.%${q}%`);
  if (cols.has("country")) searchChunks.push(`country.ilike.%${q}%`);

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(q) && cols.has("id")) searchChunks.push(`id.eq.${q}`);

  if (!searchChunks.length) return next;
  return next.or(searchChunks.join(","));
}

function userFromId(id: string) {
  return {
    id,
    name: `User ${id.slice(0, 8)}`,
    username: null,
    email: null,
    phone: null,
    city: null,
    role: "user",
    is_demo: false,
    is_blocked: false,
    shadow_banned: false,
    message_limited: false,
    blocked_reason: null,
    blocked_until: null,
    created_at: new Date(0).toISOString(),
    last_post_at: null,
    telegram_verified: false,
    profile_completed: false,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdminUserId();

    const { searchParams } = new URL(req.url);
    const parsed = userSearchSchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit") ?? 30,
    });

    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid query", 422);

    const demoFilter = (searchParams.get("demo") ?? "all") as DemoFilter;
    const sortBy = (searchParams.get("sort") ?? "created_desc") as UserSort;
    const demoGroup = (searchParams.get("demo_group") ?? "").trim();
    const roleFilter = (searchParams.get("role") ?? "all").trim();
    const cityFilter = (searchParams.get("city") ?? "").trim();
    const flagShadow = (searchParams.get("shadow_banned") ?? "").trim();
    const flagLimited = (searchParams.get("message_limited") ?? "").trim();
    const flagProfileCompleted = (searchParams.get("profile_completed") ?? "").trim();
    const { q, limit } = parsed.data;

    const schema = await getSchemaSnapshot(["users"]);
    const userCols = asSet(schema, "users");

    let users: any[] = [];

    if (userCols.has("id")) {
      const selectCols = [
        "id",
        "name",
        "username",
        "email",
        "phone",
        "telegram_user_id",
        "city",
        "country",
        "role",
        "is_demo",
        "demo_group",
        "is_blocked",
        "shadow_banned",
        "message_limited",
        "blocked_reason",
        "blocked_until",
        "created_at",
        "last_post_at",
        "telegram_verified",
        "profile_completed",
      ].filter((col) => userCols.has(col));

      if (!selectCols.includes("id")) selectCols.unshift("id");

      let query = applySearch(
        supabaseAdmin.from("users").select(selectCols.join(",")),
        q,
        limit,
        userCols,
      );

      if (demoFilter === "demo") {
        if (userCols.has("is_demo")) query = query.eq("is_demo", true);
        else if (userCols.has("name")) query = query.ilike("name", "Demo %");
      }

      if (demoFilter === "real") {
        if (userCols.has("is_demo")) query = query.or("is_demo.is.null,is_demo.eq.false");
        else if (userCols.has("name")) query = query.not("name", "ilike", "Demo %");
      }

      if (demoFilter === "traffic") {
        if (userCols.has("is_demo")) query = query.eq("is_demo", true);
        if (userCols.has("demo_group")) query = query.eq("demo_group", "traffic");
        else if (userCols.has("name")) query = query.ilike("name", "Traffic Demo %");
      }

      if (demoGroup.length && userCols.has("demo_group")) query = query.eq("demo_group", demoGroup);
      if (roleFilter !== "all" && userCols.has("role")) query = query.eq("role", roleFilter);
      if (cityFilter.length && userCols.has("city")) query = query.ilike("city", `%${cityFilter}%`);
      if (flagShadow === "true" && userCols.has("shadow_banned")) query = query.eq("shadow_banned", true);
      if (flagLimited === "true" && userCols.has("message_limited")) query = query.eq("message_limited", true);
      if (flagProfileCompleted === "true" && userCols.has("profile_completed")) query = query.eq("profile_completed", true);

      const usersRes = await query;
      if (usersRes.error) return fail(usersRes.error.message, 500);
      users = usersRes.data ?? [];
    }

    if (!users.length) {
      const events = await supabaseAdmin
        .from("analytics_events")
        .select("user_id,properties,created_at")
        .order("created_at", { ascending: false })
        .limit(120000);

      const ids = new Set<string>();
      for (const row of events.data ?? []) {
        if (!row.user_id) continue;
        if (q && !String(row.user_id).includes(q)) continue;
        if (demoGroup.length && String((row.properties as Record<string, unknown> | null)?.demo_group ?? "") !== demoGroup) continue;
        ids.add(String(row.user_id));
        if (ids.size >= limit) break;
      }

      users = [...ids].map((id) => userFromId(id));
    }

    const userIds = (users ?? []).map((u: any) => u.id);
    if (!userIds.length) return ok({ items: [] });

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [flags, reports, events, riskMap] = await Promise.all([
      supabaseAdmin.from("content_flags").select("user_id,status").in("user_id", userIds),
      supabaseAdmin.from("reports").select("target_user_id,status,created_at").in("target_user_id", userIds),
      supabaseAdmin
        .from("analytics_events")
        .select("user_id,event_name,created_at")
        .in("user_id", userIds)
        .gte("created_at", since30d)
        .limit(30000),
      buildRiskProfiles(userIds),
    ]);

    const flagsMap = new Map<string, number>();
    for (const row of flags.data ?? []) {
      if (row.status !== "open" || !row.user_id) continue;
      flagsMap.set(row.user_id, (flagsMap.get(row.user_id) ?? 0) + 1);
    }

    const reportsMap = new Map<string, number>();
    const reports7dMap = new Map<string, number>();
    for (const row of reports.data ?? []) {
      if (!row.target_user_id) continue;
      if (row.status === "open") reportsMap.set(row.target_user_id, (reportsMap.get(row.target_user_id) ?? 0) + 1);
      if (row.created_at && row.created_at >= since7d) reports7dMap.set(row.target_user_id, (reports7dMap.get(row.target_user_id) ?? 0) + 1);
    }

    const statsMap = new Map<string, { posts: number; joins: number; connectSent: number; connectReplied: number; connectSent7d: number; activity7d: number; lastSeenAt: string | null }>();
    for (const id of userIds) statsMap.set(id, { posts: 0, joins: 0, connectSent: 0, connectReplied: 0, connectSent7d: 0, activity7d: 0, lastSeenAt: null });

    for (const ev of events.data ?? []) {
      const stat = statsMap.get(ev.user_id);
      if (!stat) continue;
      if (!stat.lastSeenAt || ev.created_at > stat.lastSeenAt) stat.lastSeenAt = ev.created_at;

      const canonical = canonicalizeEventName(ev.event_name);
      if (ev.created_at >= since7d) stat.activity7d += 1;
      if (canonical === "post_published_daily_duo" || canonical === "post_published_video") stat.posts += 1;
      if (canonical === "event_joined") stat.joins += 1;
      if (canonical === "connect_sent") { stat.connectSent += 1; if (ev.created_at >= since7d) stat.connectSent7d += 1; }
      if (canonical === "connect_replied") stat.connectReplied += 1;
    }

    const mapped = (users ?? []).map((u: any) => {
        const stats = statsMap.get(u.id) ?? { posts: 0, joins: 0, connectSent: 0, connectReplied: 0, connectSent7d: 0, activity7d: 0, lastSeenAt: null };
        const risk = riskMap.get(u.id) ?? { riskScore: 0, riskStatus: "low" as const };
        const replyRate = stats.connectSent > 0 ? Number((stats.connectReplied / stats.connectSent).toFixed(3)) : 0;
        const fallbackName = typeof u.id === "string" ? `User ${u.id.slice(0, 8)}` : "Unknown";
        const inferredDemo = typeof u.name === "string" && u.name.toLowerCase().includes("demo");

        return {
          ...u,
          name: typeof u.name === "string" && u.name.trim() ? u.name : fallbackName,
          username: typeof u.username === "string" ? u.username : null,
          email: typeof u.email === "string" ? u.email : null,
          role: typeof u.role === "string" && u.role ? u.role : "user",
          city: u.city ?? u.country ?? null,
          is_demo: Boolean(u.is_demo ?? inferredDemo),
          phone: typeof u.phone === "string" ? u.phone : null,
          blocked_reason: typeof u.blocked_reason === "string" ? u.blocked_reason : null,
          blocked_until: typeof u.blocked_until === "string" ? u.blocked_until : null,
          created_at: typeof u.created_at === "string" ? u.created_at : new Date(0).toISOString(),
          last_post_at: typeof u.last_post_at === "string" ? u.last_post_at : null,
          is_blocked: Boolean(u.is_blocked),
          shadow_banned: Boolean(u.shadow_banned),
          message_limited: Boolean(u.message_limited),
          telegram_verified: Boolean(u.telegram_verified),
          profile_completed: Boolean(u.profile_completed),
          openFlags: flagsMap.get(u.id) ?? 0,
          openReports: reportsMap.get(u.id) ?? 0,
          lastSeenAt: stats.lastSeenAt,
          posts_30d: stats.posts,
          joins_30d: stats.joins,
          connects_sent_30d: stats.connectSent,
          reply_rate: replyRate,
          risk_score: risk.riskScore,
          reports_7d: reports7dMap.get(u.id) ?? 0,
          connect_sent_7d: stats.connectSent7d,
          activity_7d: stats.activity7d,
          status: u.is_blocked ? "blocked" : u.shadow_banned ? "shadowbanned" : u.message_limited ? "limited" : "active",
        };
      });

    mapped.sort((a: any, b: any) => {
      if (sortBy === "activity_7d") return Number(b.activity_7d ?? 0) - Number(a.activity_7d ?? 0);
      if (sortBy === "reports_7d") return Number(b.reports_7d ?? 0) - Number(a.reports_7d ?? 0);
      if (sortBy === "connect_sent_7d") return Number(b.connect_sent_7d ?? 0) - Number(a.connect_sent_7d ?? 0);
      if (sortBy === "reply_rate") return Number(b.reply_rate ?? 0) - Number(a.reply_rate ?? 0);
      if (sortBy === "risk_score") return Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0);
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });

    return ok({ items: mapped });
  } catch (error) {
    return adminRouteError("/api/admin/users/search", error);
  }
}
