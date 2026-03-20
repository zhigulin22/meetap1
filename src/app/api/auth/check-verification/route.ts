import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return fail("token is required", 422);
  }

  const { data, error } = await supabaseAdmin
    .from("telegram_verifications")
    .select("status, verified_phone")
    .eq("token", token)
    .single();

  if (error || !data) {
    return fail("Verification not found", 404);
  }

  let existingUser = false;

  if (data.status === "verified" && data.verified_phone) {
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", data.verified_phone)
      .maybeSingle();

    existingUser = Boolean(existing?.id);
  }

  return ok({ ...data, existingUser });
}
