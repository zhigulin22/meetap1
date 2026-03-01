import { cookies } from "next/headers";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

function maskIp(ip: string | null) {
  if (!ip) return null;
  const clean = ip.split(",")[0]?.trim() ?? ip;
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  return "hidden";
}

export async function GET() {
  try {
    const userId = requireUserId();
    const currentSessionId = cookies().get("meetap_session_id")?.value ?? null;

    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .select("id,device_label,user_agent,ip,created_at,last_active_at,revoked_at")
      .eq("user_id", userId)
      .order("last_active_at", { ascending: false })
      .limit(30);

    if (error) {
      if (error.message.toLowerCase().includes("user_sessions")) {
        return fail("Не применена миграция user_sessions", 500);
      }
      return fail(error.message, 500);
    }

    const items: Array<{
      id: string;
      device_label: string;
      user_agent: string | null;
      created_at: string;
      last_active_at: string;
      revoked_at: string | null;
      is_current: boolean;
      approx_location: string | null;
    }> = (data ?? []).map((session: { id: string; device_label: string; user_agent: string | null; ip: string | null; created_at: string; last_active_at: string; revoked_at: string | null }) => ({
      id: session.id,
      device_label: session.device_label,
      user_agent: session.user_agent,
      created_at: session.created_at,
      last_active_at: session.last_active_at,
      revoked_at: session.revoked_at,
      is_current: Boolean(currentSessionId && session.id === currentSessionId),
      approx_location: maskIp(session.ip),
    }));

    return ok({
      current_session_id: currentSessionId,
      current: items.find((x) => x.is_current) ?? null,
      items,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
