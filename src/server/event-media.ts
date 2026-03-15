import "server-only";

import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";

function extByType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  return "jpg";
}

export async function uploadEventImage(params: {
  eventId: string;
  file: File;
  userId?: string | null;
  makePrimary?: boolean;
}) {
  const schema = await getSchemaSnapshot(["event_media", "events"]);
  const mediaCols = asSet(schema, "event_media");
  const eventsCols = asSet(schema, "events");

  if (!mediaCols.size) {
    throw new Error("event_media table missing");
  }

  if (!params.file.type.startsWith("image/")) {
    throw new Error("Можно загружать только изображения");
  }

  if (params.file.size > 8 * 1024 * 1024) {
    throw new Error("Максимальный размер файла 8MB");
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const ext = extByType(params.file.type);
  const path = `events/${params.eventId}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabaseAdmin.storage
    .from("event-media")
    .upload(path, buffer, { contentType: params.file.type });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const publicUrl = supabaseAdmin.storage.from("event-media").getPublicUrl(path).data.publicUrl;

  const insertCandidate = {
    event_id: params.eventId,
    media_type: "image",
    storage_bucket: "event-media",
    storage_path: path,
    original_filename: params.file.name,
    mime_type: params.file.type,
    file_size_bytes: params.file.size,
    sort_order: 0,
    is_primary: false,
    uploaded_by: params.userId ?? null,
  };

  const insertPayload = pickExistingColumns(insertCandidate, mediaCols);
  const { data: media, error } = await supabaseAdmin
    .from("event_media")
    .insert(insertPayload)
    .select("id,is_primary")
    .single();

  if (error || !media?.id) {
    throw new Error(error?.message ?? "Не удалось сохранить медиа");
  }

  const shouldMakePrimary = params.makePrimary ?? true;
  if (shouldMakePrimary && eventsCols.has("primary_media_id")) {
    await supabaseAdmin.from("event_media").update({ is_primary: false }).eq("event_id", params.eventId);
    await supabaseAdmin.from("event_media").update({ is_primary: true }).eq("id", media.id);
    await supabaseAdmin.from("events").update({ primary_media_id: media.id }).eq("id", params.eventId);
  }

  return { id: media.id, url: publicUrl, path };
}

export async function setPrimaryEventImage(eventId: string, mediaId: string) {
  const schema = await getSchemaSnapshot(["event_media", "events"]);
  const eventsCols = asSet(schema, "events");
  const mediaCols = asSet(schema, "event_media");

  if (!mediaCols.size) throw new Error("event_media table missing");

  await supabaseAdmin.from("event_media").update({ is_primary: false }).eq("event_id", eventId);
  await supabaseAdmin.from("event_media").update({ is_primary: true }).eq("id", mediaId);

  if (eventsCols.has("primary_media_id")) {
    await supabaseAdmin.from("events").update({ primary_media_id: mediaId }).eq("id", eventId);
  }
}

export async function getPrimaryMediaMap(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, string>();

  const { data } = await supabaseAdmin
    .from("event_media")
    .select("event_id,storage_bucket,storage_path,is_primary")
    .in("event_id", eventIds)
    .eq("is_primary", true)
    .limit(200);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const url = supabaseAdmin.storage.from(row.storage_bucket).getPublicUrl(row.storage_path).data.publicUrl;
    map.set(row.event_id, url);
  }
  return map;
}

