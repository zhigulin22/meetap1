import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { getCurrentUserId } from "@/server/auth";

const BASE_FIELDS = [
  "id",
  "name",
  "username",
  "bio",
  "country",
  "city",
  "telegram_verified",
  "last_post_at",
  "xp",
  "level",
  "university",
  "work",
  "hobbies",
  "interests",
  "facts",
  "avatar_url",
  "preferences",
  "student_verified",
  "student_verified_at",
  "student_university",
  "student_verification_status",
  "personality_profile",
  "personality_updated_at",
  "profile_completed",
];

async function getProfileFieldList() {
  const snapshot = await getSchemaSnapshot(["users"]);
  const cols = asSet(snapshot, "users");
  return BASE_FIELDS.filter((f) => cols.has(f)).join(",");
}

function toObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, any>) : {};
}

function computeCompatibility(me: any, target: any) {
  if (!me || !target) return null;
  const myInterests = Array.isArray(me.interests) ? me.interests : [];
  const targetInterests = Array.isArray(target.interests) ? target.interests : [];
  const common = targetInterests.filter((x: string) => myInterests.includes(x));
  const base = 35 + common.length * 18 + (target.level ?? 1) * 2;
  const sameStyle =
    me.personality_profile?.style &&
    target.personality_profile?.style &&
    me.personality_profile.style === target.personality_profile.style;
  const boost = sameStyle ? 8 : 0;
  const score = Math.min(97, Math.round(base + boost));
  const reasons: string[] = [];
  if (common.length) reasons.push(`Общие интересы: ${common.slice(0, 3).join(", ")}`);
  if (sameStyle) reasons.push("Похожий стиль общения");
  if (!reasons.length) reasons.push("Подходит по ритму общения и целям");
  return { score, reasons, common };
}

function buildContent(posts: any[], photos: any[]) {
  const photosMap = new Map<string, Array<{ kind: string; url: string }>>();
  for (const p of photos) {
    const list = photosMap.get(p.post_id) ?? [];
    list.push({ kind: p.kind, url: p.url });
    photosMap.set(p.post_id, list);
  }
  const items = posts.map((post) => ({
    id: post.id,
    type: post.type,
    caption: post.caption ?? null,
    created_at: post.created_at,
    photos: photosMap.get(post.id) ?? [],
  }));
  return {
    all: items,
    videos: items.filter((p) => p.type === "reel"),
    photos: items.filter((p) => p.type !== "reel"),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const viewerId = getCurrentUserId();
    const fields = await getProfileFieldList();

    const { data: profile, error } = await supabaseAdmin
      .from("users")
      .select(fields)
      .eq("id", params.id)
      .limit(1)
      .maybeSingle();

    if (error || !profile) return fail("Профиль не найден", 404);

    const schema = await getSchemaSnapshot(["posts", "photos", "event_members", "connections", "events", "users"]);
    const postCols = asSet(schema, "posts");
    const photoCols = asSet(schema, "photos");
    const eventsCols = asSet(schema, "events");
    const membersCols = asSet(schema, "event_members");
    const connectionsCols = asSet(schema, "connections");
    const usersCols = asSet(schema, "users");

    let posts: any[] = [];
    let photos: any[] = [];
    if (postCols.size) {
      const { data: postsRes } = await supabaseAdmin
        .from("posts")
        .select("id,user_id,type,caption,created_at,moderation_status")
        .eq("user_id", params.id)
        .in("moderation_status", ["clean", "limited"])
        .order("created_at", { ascending: false })
        .limit(40);
      posts = postsRes ?? [];
    }

    if (photoCols.size && posts.length) {
      const postIds = posts.map((p) => p.id);
      const { data: photoRows } = await supabaseAdmin
        .from("photos")
        .select("post_id,kind,url")
        .in("post_id", postIds);
      photos = photoRows ?? [];
    }

    const privacyRowRes = await supabaseAdmin.from("user_privacy_settings").select("*").eq("user_id", params.id).limit(1).maybeSingle();
    const privacyJson = toObject((profile as any).privacy_settings);

    const viewerRes = viewerId
      ? await supabaseAdmin
          .from("users")
          .select("id,interests,level,personality_profile")
          .eq("id", viewerId)
          .limit(1)
          .maybeSingle()
      : { data: null };

    const compatibility = viewerId && viewerId !== params.id ? computeCompatibility(viewerRes.data, profile) : null;

    let commonEvents: any[] = [];
    if (viewerId && viewerId !== params.id && membersCols.has("event_id") && membersCols.has("user_id") && eventsCols.size) {
      const [viewerEvents, targetEvents] = await Promise.all([
        supabaseAdmin.from("event_members").select("event_id").eq("user_id", viewerId).limit(200),
        supabaseAdmin.from("event_members").select("event_id").eq("user_id", params.id).limit(200),
      ]);

      const viewerSet = new Set((viewerEvents.data ?? []).map((x: any) => x.event_id));
      const sharedIds = (targetEvents.data ?? []).map((x: any) => x.event_id).filter((id: any) => viewerSet.has(id));
      if (sharedIds.length) {
        const selectCols = ["id", "title", "city", "starts_at", "cover_url", "image_url"].filter((c) => eventsCols.has(c));
        const { data: eventsData } = await supabaseAdmin
          .from("events")
          .select(selectCols.join(","))
          .in("id", sharedIds.slice(0, 8));
        commonEvents = eventsData ?? [];
      }
    }

    let commonPeople: any[] = [];
    if (viewerId && viewerId !== params.id && connectionsCols.size && usersCols.size) {
      const hasFrom = connectionsCols.has("from_user_id");
      const hasTo = connectionsCols.has("to_user_id");
      if (hasFrom && hasTo) {
        const [viewerConn, targetConn] = await Promise.all([
          supabaseAdmin.from("connections").select("from_user_id,to_user_id,status").eq("from_user_id", viewerId).limit(200),
          supabaseAdmin.from("connections").select("from_user_id,to_user_id,status").eq("from_user_id", params.id).limit(200),
        ]);
        const viewerIds = new Set((viewerConn.data ?? []).map((x: any) => x.to_user_id));
        const shared = (targetConn.data ?? []).map((x: any) => x.to_user_id).filter((id: any) => viewerIds.has(id));
        if (shared.length) {
          const selectCols = ["id", "name", "avatar_url", "interests"].filter((c) => usersCols.has(c));
          const { data: people } = await supabaseAdmin
            .from("users")
            .select(selectCols.join(","))
            .in("id", shared.slice(0, 8));
          commonPeople = people ?? [];
        }
      }
    }

    const stats = {
      followers: 0,
      publications: posts.length,
      events: 0,
    };

    return ok({
      profile,
      stats,
      status: (profile as any).profile_completed ? "Профиль заполнен" : "Профиль заполняется",
      positiveFact: "Заполненный профиль повышает доверие и совместимость.",
      content: buildContent(posts, photos),
      compatibility,
      common_events: commonEvents,
      common_people: commonPeople,
      privacy_settings: {
        ...privacyJson,
        show_facts: privacyRowRes.data?.show_facts ?? true,
        show_event_history: privacyRowRes.data?.show_event_history ?? true,
        show_city: privacyRowRes.data?.show_city ?? true,
        show_work: privacyRowRes.data?.show_work ?? true,
        show_university: privacyRowRes.data?.show_university ?? true,
        show_last_active: privacyRowRes.data?.show_last_active ?? true,
        show_badges: privacyRowRes.data?.show_badges ?? true,
        show_interests: privacyRowRes.data?.show_interests ?? true,
      },
    });
  } catch {
    return fail("Not found", 404);
  }
}
