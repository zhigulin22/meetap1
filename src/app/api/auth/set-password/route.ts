import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

const schema = z.object({
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return fail("Пароль должен быть от 8 символов", 422);
    }

    const passwordHash = hashPassword(parsed.data.password);

    const { error } = await supabaseAdmin
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", userId);

    if (error) {
      if (error.message.toLowerCase().includes("password_hash")) {
        return fail("Не применена миграция password_hash", 500);
      }
      return fail(error.message, 500);
    }

    cookies().set("meetap_verified", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return ok({ success: true });
  } catch {
    return fail("Unauthorized", 401);
  }
}
