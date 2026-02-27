import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

function buildClient() {
  const pub = getPublicEnv();
  const sec = getServerEnv();

  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, sec.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export function getAdminSupabase() {
  return buildClient();
}

export function getAdminClient() {
  return getAdminSupabase();
}

export const supabaseAdmin: any = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getAdminSupabase() as any;
      return client[prop];
    },
  },
);
