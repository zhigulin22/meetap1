import { fail, ok } from "@/lib/http";
import { createDailyDuoSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { validateFaces } from "@/server/ai";
import { trackEvent } from "@/server/analytics";

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export async function POST(req: Request) {
  try {
    const env = getServerEnv();
    const userId = requireUserId();
    const rate = checkRateLimit(`duo:${userId}`, 10, 24 * 60 * 60 * 1000);
    if (!rate.ok) {
      return fail("Daily Duo limit reached", 429);
    }

    const formData = await req.formData();
    const photo = (formData.get("photo") as File | null) ?? (formData.get("front") as File | null);
    const captionRaw = (formData.get("caption") as string | null) ?? undefined;

    if (!photo) {
      return fail("photo is required", 422);
    }

    const captionCheck = createDailyDuoSchema.safeParse({ caption: captionRaw });
    if (!captionCheck.success) {
      return fail(captionCheck.error.message, 422);
    }

    const photoPath = `${userId}/${crypto.randomUUID()}-photo.jpg`;
    const photoBuffer = Buffer.from(await photo.arrayBuffer());
    const photoUpload = await supabaseAdmin.storage.from("daily-duo").upload(photoPath, photoBuffer, {
      contentType: photo.type || "image/jpeg",
    });

    if (photoUpload.error) {
      return fail(photoUpload.error.message || "Upload failed", 500);
    }

    const photoUrl = supabaseAdmin.storage.from("daily-duo").getPublicUrl(photoPath).data.publicUrl;

    let checkPhoto = await validateFaces({ imageUrl: photoUrl });

    // Fallback to base64 if URL-based inspection is uncertain.
    if (!checkPhoto.ok || checkPhoto.faces_count < 1) {
      checkPhoto = await validateFaces({ base64: photoBuffer.toString("base64") });
    }

    const facesCount = checkPhoto.faces_count ?? 0;
    const bonusXp = facesCount >= 2 ? env.DAILY_DUO_GROUP_BONUS_XP : 0;

    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .insert({ user_id: userId, type: "daily_duo", caption: captionCheck.data.caption ?? null })
      .select("id")
      .single();

    if (postErr || !post) {
      return fail(postErr?.message || "Post create failed", 500);
    }

    const { error: photoErr } = await supabaseAdmin.from("photos").insert([
      { post_id: post.id, user_id: userId, kind: "front", url: photoUrl },
    ]);

    if (photoErr) {
      return fail(photoErr.message, 500);
    }

    const { data: me, error: meErr } = await supabaseAdmin.from("users").select("xp,level").eq("id", userId).single();
    if (meErr || !me) {
      return fail(meErr?.message || "User not found", 404);
    }

    const currentXp = Number(me.xp ?? 0);
    const nextXp = currentXp + bonusXp;
    const updatePayload: Record<string, string | number> = {
      last_post_at: new Date().toISOString(),
    };
    if (bonusXp > 0) {
      updatePayload.xp = nextXp;
      updatePayload.level = levelFromXp(nextXp);
    }

    await supabaseAdmin.from("users").update(updatePayload).eq("id", userId);

    await trackEvent({
      eventName: "daily_duo_published",
      userId,
      path: "/feed",
      properties: {
        postId: post.id,
        facesCount,
        bonusXp,
      },
    });

    return ok({ success: true, postId: post.id, facesCount, bonusXp });
  } catch {
    return fail("Unauthorized", 401);
  }
}
