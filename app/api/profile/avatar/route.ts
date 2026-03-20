import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

function extByType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  return "jpg";
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return fail("Файл не выбран", 422);
    }

    if (!file.type.startsWith("image/")) {
      return fail("Можно загружать только изображения", 422);
    }

    if (file.size > 8 * 1024 * 1024) {
      return fail("Максимальный размер файла 8MB", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extByType(file.type);
    const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

    const upload = await supabaseAdmin.storage
      .from("daily-duo")
      .upload(path, buffer, { contentType: file.type });

    if (upload.error) {
      return fail(upload.error.message, 500);
    }

    const url = supabaseAdmin.storage.from("daily-duo").getPublicUrl(path).data.publicUrl;

    const { error } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: url })
      .eq("id", userId);

    if (error) {
      return fail(error.message, 500);
    }

    return ok({ url });
  } catch {
    return fail("Unauthorized", 401);
  }
}
