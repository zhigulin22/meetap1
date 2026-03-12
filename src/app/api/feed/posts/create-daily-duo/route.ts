import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { uploadBase64Image } from "@/supabase/storage";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { validateFaces } from "@/server/ai";
import { trackEvent } from "@/server/analytics";

const schema = z.object({
  frontBase64: z.string().min(40),
  backBase64: z.string().min(40),
  caption: z.string().max(220).optional(),
});

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const faceFront = await validateFaces({ base64: parsed.data.frontBase64 });
    const faceBack = await validateFaces({ base64: parsed.data.backBase64 });

    const facesCount = (faceFront.faces_count ?? 0) + (faceBack.faces_count ?? 0);
    if (!faceFront.ok || !faceBack.ok || facesCount < 2) {      return fail("Нужно минимум 2 лица на Daily Duo (проверь front/back фото)", 422);
    }

    const frontUrl = await uploadBase64Image({
      bucket: "daily-duo",
      path: `${userId}/${Date.now()}-front.jpg`,
      base64: parsed.data.frontBase64,
    });

    const backUrl = await uploadBase64Image({
      bucket: "daily-duo",
      path: `${userId}/${Date.now()}-back.jpg`,
      base64: parsed.data.backBase64,
    });

    const captionCheck = z.object({ caption: z.string().max(220).optional() }).safeParse({
      caption: parsed.data.caption,
    });

    if (!captionCheck.success) {
      return fail(
        captionCheck.error.issues[0]?.message ?? "Caption is invalid",
        422,
      );
    }

    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .insert({ user_id: userId, type: "daily_duo", caption: captionCheck.data.caption ?? null, risk_score: 0, moderation_status: "clean" })
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

    await trackEvent({
      eventName: "feed.post_published_daily_duo",
      userId,
      path: "/feed",
      properties: { postId: post.id, type: "daily_duo" },
    });

    return ok({ success: true, postId: post.id });
  } catch {
    return fail("Unauthorized", 401);
  }
}
