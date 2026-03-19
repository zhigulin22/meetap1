import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { asSet, getSchemaSnapshot, pickExistingColumns } from "@/server/schema-introspect";
import { sendStudentVerificationToTelegramModeration } from "@/server/telegram-student-verification";

const BUCKET = "student-ids";

function extByType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  return "jpg";
}

async function ensureBucket() {
  try {
    const { data } = await supabaseAdmin.storage.listBuckets();
    if (data?.some((b: { name: string }) => b.name === BUCKET)) return;
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  } catch {
    // ignore
  }
}

async function getLatestVerification(userId: string) {
  const { data } = await supabaseAdmin
    .from("student_verifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function GET() {
  try {
    const userId = requireUserId();
    const latest = await getLatestVerification(userId);
    return ok({ verification: latest });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const formData = await req.formData();
    const file = formData.get("student_id") as File | null;
    const university = String(formData.get("university") ?? "").trim();
    const studentIdNumber = String(formData.get("student_id_number") ?? "").trim();

    if (!file) {
      return fail("Добавь фото студенческого билета", 422);
    }

    if (!file.type.startsWith("image/")) {
      return fail("Можно загружать только изображения", 422);
    }

    if (file.size > 8 * 1024 * 1024) {
      return fail("Максимальный размер файла 8MB", 422);
    }

    await ensureBucket();

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extByType(file.type);
    const storagePath = `student-ids/${userId}/${crypto.randomUUID()}.${ext}`;

    const upload = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
    });

    if (upload.error) {
      return fail(upload.error.message, 500);
    }

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    const previewUrl = signed.data?.signedUrl ?? null;

    const schema = await getSchemaSnapshot(["student_verifications"]);
    const cols = asSet(schema, "student_verifications");

    if (!cols.size) {
      return fail("Не настроена таблица student_verifications", 500);
    }

    const insertCandidate = {
      user_id: userId,
      status: "pending",
      university: university || null,
      student_id_number: studentIdNumber || null,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      file_url: previewUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertPayload = pickExistingColumns(insertCandidate, cols);
    const { data: verification, error } = await supabaseAdmin
      .from("student_verifications")
      .insert(insertPayload)
      .select("id,status,university,student_id_number,storage_bucket,storage_path,file_url,created_at")
      .single();

    if (error || !verification?.id) {
      return fail(error?.message ?? "Не удалось создать заявку", 500);
    }

    const telegramResult = await sendStudentVerificationToTelegramModeration({
      id: verification.id,
      userId,
      university: university || null,
      studentIdNumber: studentIdNumber || null,
      fileUrl: previewUrl,
      storagePath,
    });

    if (!telegramResult.ok) {
      return fail(`Заявка сохранена, но не отправлена модераторам: ${telegramResult.reason}`, 502);
    }

    return ok({ verification });
  } catch {
    return fail("Unauthorized", 401);
  }
}
