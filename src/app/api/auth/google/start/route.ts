import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/supabase/server";

const PLACEHOLDER_URLS = ["https://xxxx.supabase.co", "https://placeholder.supabase.co"];

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !PLACEHOLDER_URLS.includes(url) &&
    !url.includes("xxxx") &&
    key.length > 20 &&
    key !== "your_anon_key"
  );
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/register?error=google_unavailable`);
  }

  try {
    const supabase = createClient();

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
  } catch {
    return NextResponse.redirect(`${origin}/register?error=google_unavailable`);
  }
}
