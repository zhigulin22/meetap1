import { generateRegistrationOptions } from "@simplewebauthn/server";
import { ok, fail } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { getPublicEnv } from "@/lib/env";

export async function GET() {
  try {
    const userId = requireUserId();

    // Get existing credentials to exclude re-registration of same device
    const { data: existing } = await supabaseAdmin
      .from("user_passkeys")
      .select("credential_id")
      .eq("user_id", userId);

    const options = await generateRegistrationOptions({
      rpName: "Meetap",
      rpID: new URL(getPublicEnv().NEXT_PUBLIC_APP_URL || "https://meetap-new.vercel.app").hostname,
      userID: Buffer.from(userId),
      userName: userId,
      userDisplayName: "Meetap User",
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: (existing ?? []).map((r) => ({
        id: r.credential_id,
        type: "public-key" as const,
      })),
    });

    // Store challenge (expires 5 min via DB default)
    await supabaseAdmin
      .from("webauthn_challenges")
      .insert({ user_id: userId, challenge: options.challenge });

    return ok(options);
  } catch {
    return fail("Unauthorized", 401);
  }
}
