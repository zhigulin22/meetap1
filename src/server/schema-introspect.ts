import { supabaseAdmin } from "@/supabase/admin";

export const ADMIN_SCHEMA_TABLES = [
  "users",
  "events",
  "analytics_events",
  "reports",
  "feature_flags",
  "experiments",
  "alerts",
  "moderation_actions",
  "event_submissions",
  "import_jobs",
  "event_import_jobs",
  "posts",
  "connections",
  "messages",
  "traffic_runs",
  "event_members",
  "event_media",
] as const;

type TableName = (typeof ADMIN_SCHEMA_TABLES)[number] | string;
export type SchemaIntrospectResult = Record<string, string[]>;

const CANDIDATE_COLUMNS: Record<string, string[]> = {
  users: [
    "id",
    "phone",
    "name",
    "username",
    "email",
    "role",
    "telegram_verified",
    "telegram_user_id",
    "is_demo",
    "demo_group",
    "city",
    "country",
    "interests",
    "hobbies",
    "facts",
    "profile_completed",
    "is_blocked",
    "shadow_banned",
    "message_limited",
    "created_at",
    "last_post_at",
    "bio",
    "avatar_url",
    "blocked_reason",
    "blocked_until",
    "level",
    "xp",
  ],
  events: [
    "id",
    "title",
    "description",
    "description_short",
    "description_full",
    "short_description",
    "full_description",
    "outcomes",
    "cover_url",
    "image_url",
    "event_date",
    "starts_at",
    "ends_at",
    "price",
    "price_min",
    "price_max",
    "price_text",
    "price_note",
    "is_paid",
    "city",
    "location",
    "venue_name",
    "venue_address",
    "category",
    "raw_category",
    "source_type",
    "source_kind",
    "source_name",
    "source_url",
    "source_event_id",
    "external_event_id",
    "external_source",
    "external_url",
    "ticket_url",
    "organizer_name",
    "organizer_telegram",
    "social_mode",
    "participant_limit",
    "looking_for_count",
    "submission_id",
    "import_job_id",
    "status",
    "moderation_status",
    "source_meta",
    "is_demo",
    "demo_group",
    "created_at",
    "updated_at",
    "primary_media_id",
  ],
  event_submissions: [
    "id",
    "event_id",
    "user_id",
    "creator_user_id",
    "title",
    "category",
    "format",
    "mode",
    "short_description",
    "full_description",
    "city",
    "venue",
    "address",
    "starts_at",
    "ends_at",
    "cover_image_url",
    "cover_urls",
    "is_paid",
    "price",
    "price_text",
    "payment_url",
    "payment_note",
    "organizer_name",
    "organizer_telegram",
    "telegram_contact",
    "participant_limit",
    "looking_for_count",
    "moderator_comment",
    "moderation_status",
    "moderation_reason",
    "published_event_id",
    "created_at",
    "updated_at",
  ],
  import_jobs: [
    "id",
    "source_name",
    "status",
    "requested_categories",
    "city",
    "started_at",
    "finished_at",
    "imported_count",
    "seeded_count",
    "errors",
    "meta",
    "created_by",
    "created_at",
    "updated_at",
  ],
  event_import_jobs: [
    "id",
    "source_name",
    "status",
    "started_at",
    "finished_at",
    "stats_json",
    "error_text",
    "created_by",
    "created_at",
    "updated_at",
  ],
  analytics_events: ["id", "user_id", "event_name", "properties", "path", "created_at"],
  reports: [
    "id",
    "reporter_user_id",
    "target_user_id",
    "content_type",
    "content_id",
    "reason",
    "details",
    "status",
    "created_at",
  ],
  posts: ["id", "user_id", "type", "caption", "is_demo", "demo_group", "created_at"],
  connections: ["id", "from_user_id", "to_user_id", "status", "is_demo", "demo_group", "created_at"],
  messages: ["id", "from_user_id", "to_user_id", "content", "is_demo", "demo_group", "created_at"],
  event_members: ["id", "event_id", "user_id", "joined_at", "created_at"],
  event_media: [
    "id",
    "event_id",
    "media_type",
    "storage_bucket",
    "storage_path",
    "original_filename",
    "mime_type",
    "file_size_bytes",
    "width",
    "height",
    "duration_seconds",
    "alt_text",
    "sort_order",
    "is_primary",
    "uploaded_by",
    "created_at",
  ],
  traffic_runs: [
    "id",
    "status",
    "users_count",
    "interval_sec",
    "intensity",
    "chaos",
    "created_by",
    "started_at",
    "stopped_at",
    "updated_at",
    "created_at",
  ],
  feature_flags: ["id", "key", "enabled", "rollout", "scope", "payload", "updated_at"],
  experiments: ["id", "key", "variants", "rollout_percent", "status", "primary_metric", "updated_at", "created_at"],
  alerts: ["id", "type", "metric", "threshold", "status", "created_at", "updated_at"],
  moderation_actions: ["id", "action", "target_type", "target_id", "created_at"],
};

function isMissingTableError(message?: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("relation") && m.includes("does not exist") || m.includes("could not find the table") || m.includes("schema cache");
}

function isMissingColumnError(message: string | undefined, column: string) {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

async function tryInformationSchema(tables: string[]): Promise<SchemaIntrospectResult | null> {
  const q = await supabaseAdmin
    .schema("information_schema")
    .from("columns")
    .select("table_name,column_name,data_type")
    .eq("table_schema", "public")
    .in("table_name", tables);

  if (q.error || !q.data) return null;

  const out: SchemaIntrospectResult = {};
  for (const t of tables) out[t] = [];

  for (const row of q.data as Array<{ table_name: string; column_name: string }>) {
    if (!out[row.table_name]) out[row.table_name] = [];
    out[row.table_name]!.push(row.column_name);
  }

  for (const t of Object.keys(out)) {
    out[t] = Array.from(new Set(out[t] ?? [])).sort();
  }
  return out;
}

async function probeColumnsForTable(table: string): Promise<string[]> {
  const candidates = CANDIDATE_COLUMNS[table] ?? ["id", "created_at", "updated_at", "name", "title", "key", "event_name"];

  const probeTable = await supabaseAdmin.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (probeTable.error && isMissingTableError(probeTable.error.message)) {
    return [];
  }

  const existing: string[] = [];
  for (const column of candidates) {
    const q = await supabaseAdmin.from(table).select(column, { head: true, count: "exact" }).limit(1);
    if (!q.error) {
      existing.push(column);
      continue;
    }
    if (isMissingColumnError(q.error.message, column)) continue;
  }

  return Array.from(new Set(existing)).sort();
}

export async function getSchemaSnapshot(tablesInput?: readonly TableName[]) {
  const tables = Array.from(new Set((tablesInput ?? ADMIN_SCHEMA_TABLES) as string[]));

  const fromInfo = await tryInformationSchema(tables);
  if (fromInfo) return fromInfo;

  const out: SchemaIntrospectResult = {};
  for (const table of tables) {
    out[table] = await probeColumnsForTable(table);
  }
  return out;
}

export function asSet(snapshot: SchemaIntrospectResult, table: string) {
  return new Set(snapshot[table] ?? []);
}

export function pickExistingColumns<T extends Record<string, unknown>>(row: T, cols: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (cols.has(key)) out[key] = value;
  }
  return out;
}
