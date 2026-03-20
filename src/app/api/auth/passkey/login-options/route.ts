import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { ok, fail } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getPublicEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return fail("userId required", 400);

    const { data: passkeys } = await supabaseAdmin
      .from("user_passkeys")
      .select("credential_id")
      .eq("user_id", userId);

    if (!passkeys?.length) return fail("No passkeys registered", 404);

    const rpID = new URL(getPublicEnv().NEXT_PUBLIC_APP_URL || "https://meetap-new.vercel.app").hostname;

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((p) => ({
        id: p.credential_id,
        type: "public-key" as const,
      })),
      userVerification: "required",
    });

    // Store challenge
    await supabaseAdmin
      .from("webauthn_challenges")
      .insert({ user_id: userId, challenge: options.challenge });

    return ok(options);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Error", 400);
  }
}
