import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const origin = req.nextUrl.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/google/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/register?error=google_unavailable`);
  }

  return NextResponse.redirect(data.url);
}
