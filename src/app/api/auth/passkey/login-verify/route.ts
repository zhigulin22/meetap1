import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { fail } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { detectDeviceLabel } from "@/lib/session";
import { getPublicEnv } from "@/lib/env";

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function POST(req: NextRequest) {
  try {
    const { userId, response } = await req.json();
    if (!userId || !response) return fail("userId and response required", 400);

    // Get passkey by credential id
    const credentialId = response.id;
    const { data: passkey } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, credential_id, public_key, counter")
      .eq("user_id", userId)
      .eq("credential_id", credentialId)
      .maybeSingle();

    if (!passkey) return fail("Passkey not found", 404);

    // Get the stored challenge
    const { data: challengeRow } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", userId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow) return fail("Challenge not found", 400);
    if (new Date(challengeRow.expires_at) < new Date()) return fail("Challenge expired", 400);

    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL || "https://meetap-new.vercel.app";
    const origin = new URL(appUrl).origin;
    const rpID = new URL(appUrl).hostname;

    const publicKeyBuffer = Buffer.from(passkey.public_key, "base64");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyBuffer,
        counter: passkey.counter,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) return fail("Verification failed", 401);

    // Delete challenge
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    // Update counter
    await supabaseAdmin
      .from("user_passkeys")
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq("id", passkey.id);

    // Create session
    const ua = req.headers.get("user-agent") ?? "";
    const ip = req.headers.get("x-forwarded-for") ?? null;
    const deviceLabel = detectDeviceLabel(ua);

    const { data: session } = await supabaseAdmin
      .from("user_sessions")
      .insert({ user_id: userId, device_label: deviceLabel, user_agent: ua, ip })
      .select("id")
      .maybeSingle();

    const res = NextResponse.json({ ok: true });
    res.cookies.set("meetap_user_id", userId, COOKIE_BASE);
    res.cookies.set("meetap_verified", "1", COOKIE_BASE);
    if (session?.id) {
      res.cookies.set("meetap_session_id", session.id, COOKIE_BASE);
    }
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Error", 400);
  }
}
