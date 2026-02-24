import { fail, ok } from "@/lib/http";
import { createDailyDuoSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { validateFaces } from "@/server/ai";

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const rate = checkRateLimit(`duo:${userId}`, 10, 24 * 60 * 60 * 1000);
    if (!rate.ok) {
      return fail("Daily Duo limit reached", 429);
    }

    const formData = await req.formData();
    const front = formData.get("front") as File | null;
    const back = formData.get("back") as File | null;
    const captionRaw = (formData.get("caption") as string | null) ?? undefined;

    if (!front || !back) {
      return fail("front and back images are required", 422);
    }

    const captionCheck = createDailyDuoSchema.safeParse({ caption: captionRaw });
    if (!captionCheck.success) {
      return fail(captionCheck.error.message, 422);
    }

    const frontPath = `${userId}/${crypto.randomUUID()}-front.jpg`;
    const backPath = `${userId}/${crypto.randomUUID()}-back.jpg`;

    const frontBuffer = Buffer.from(await front.arrayBuffer());
    const backBuffer = Buffer.from(await back.arrayBuffer());

    const [frontUpload, backUpload] = await Promise.all([
      supabaseAdmin.storage.from("daily-duo").upload(frontPath, frontBuffer, {
        contentType: front.type || "image/jpeg",
      }),
      supabaseAdmin.storage.from("daily-duo").upload(backPath, backBuffer, {
        contentType: back.type || "image/jpeg",
      }),
    ]);

    if (frontUpload.error || backUpload.error) {
      return fail(frontUpload.error?.message || backUpload.error?.message || "Upload failed", 500);
    }

    const frontUrl = supabaseAdmin.storage.from("daily-duo").getPublicUrl(frontPath).data.publicUrl;
    const backUrl = supabaseAdmin.storage.from("daily-duo").getPublicUrl(backPath).data.publicUrl;

    let checkFront = await validateFaces({ imageUrl: frontUrl });
    let checkBack = await validateFaces({ imageUrl: backUrl });

    // Fallback to base64 if URL-based inspection is uncertain.
    if (!checkFront.ok || checkFront.faces_count < 1) {
      checkFront = await validateFaces({ base64: frontBuffer.toString("base64") });
    }
    if (!checkBack.ok || checkBack.faces_count < 1) {
      checkBack = await validateFaces({ base64: backBuffer.toString("base64") });
    }

    const totalFaces = (checkFront.faces_count ?? 0) + (checkBack.faces_count ?? 0);

    if (totalFaces < 2) {
      return fail(
        `Нужно минимум 2 человека на Daily Duo. front=${checkFront.faces_count}, back=${checkBack.faces_count}`,
        422,
      );
    }

    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .insert({ user_id: userId, type: "daily_duo", caption: captionCheck.data.caption ?? null })
      .select("id")
      .single();

    if (postErr || !post) {
      return fail(postErr?.message || "Post create failed", 500);
    }

    const { error: photoErr } = await supabaseAdmin.from("photos").insert([
      { post_id: post.id, user_id: userId, kind: "front", url: frontUrl },
      { post_id: post.id, user_id: userId, kind: "back", url: backUrl },
    ]);

    if (photoErr) {
      return fail(photoErr.message, 500);
    }

    await supabaseAdmin
      .from("users")
      .update({ last_post_at: new Date().toISOString(), xp: 10 })
      .eq("id", userId);

    return ok({ success: true, postId: post.id });
  } catch {
    return fail("Unauthorized", 401);
  }
}
