import { supabaseAdmin } from "@/supabase/admin";

function decodeBase64(input: string) {
  const marker = "base64,";
  const idx = input.indexOf(marker);
  const raw = idx >= 0 ? input.slice(idx + marker.length) : input;
  return Buffer.from(raw, "base64");
}

function inferContentType(input: string) {
  if (input.startsWith("data:image/png")) return "image/png";
  if (input.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

export async function uploadBase64Image(input: {
  bucket: string;
  path: string;
  base64: string;
}) {
  const buffer = decodeBase64(input.base64);
  const contentType = inferContentType(input.base64);

  const { error } = await supabaseAdmin.storage.from(input.bucket).upload(input.path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabaseAdmin.storage.from(input.bucket).getPublicUrl(input.path);
  return data.publicUrl;
}
