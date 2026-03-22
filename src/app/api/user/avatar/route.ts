import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { getAdminClient } from "@/supabase/admin";
import { ok, fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const userId = cookieStore.get("meetap_user_id")?.value;

  const formData = await req.formData().catch(() => null);
  if (!formData) return fail("Неверный запрос", 400);

  const file = formData.get("file") as File | null;
  if (!file) return fail("Файл не передан", 400);

  // (type/ext check is below)
  if (file.size > 5 * 1024 * 1024) return fail("Файл слишком большой (макс. 5 МБ)", 400);

  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
    "image/gif": "gif", "image/avif": "avif",
  };
  const nameExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = MIME_TO_EXT[file.type] ?? nameExt ?? "jpg";

  // iOS sometimes sends empty type — accept by extension instead
  const VALID_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "avif"];
  const isImage = file.type.startsWith("image/") || VALID_EXTS.includes(nameExt);
  if (!isImage) return fail("Только изображения", 400);

  // During registration userId cookie doesn't exist yet — upload to temp path
  const folder = userId ?? "pending";
  const path = `${folder}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const client = getAdminClient();
  const { error } = await client.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) return fail(`Ошибка загрузки: ${error.message}`, 500);

  const { data: urlData } = client.storage.from("avatars").getPublicUrl(path);
  const url = urlData.publicUrl;

  // Only update DB if user is already authenticated
  if (userId) {
    await supabaseAdmin.from("users").update({ avatar_url: url }).eq("id", userId);
  }

  return ok({ url });
}
