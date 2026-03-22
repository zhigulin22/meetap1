import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { ok, fail } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { getPublicEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json();

    // Get the stored challenge
    const { data: challengeRow } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", userId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow) return fail("Challenge not found or expired", 400);
    if (new Date(challengeRow.expires_at) < new Date()) return fail("Challenge expired", 400);

    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL || "https://meetap-new.vercel.app";
    const origin = new URL(appUrl).origin;
    const rpID = new URL(appUrl).hostname;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return fail("Verification failed", 400);
    }

    const { credential } = verification.registrationInfo;

    // Delete used challenge
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    // Save passkey
    await supabaseAdmin.from("user_passkeys").insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      device_type: (credential as any).deviceType ?? null,
    });

    return ok({ verified: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Error", 400);
  }
}
