import { ok } from "@/lib/http";
import { adminRouteError } from "@/server/admin-error";
import { requireAdminUserId } from "@/server/admin";
import { probeTables } from "@/server/admin-tables";
import { supabaseAdmin } from "@/supabase/admin";

function hasRealEnv(name: string) {
  const value = process.env[name];
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.includes("placeholder")) return false;
  if (v === "qa-bots-control-disabled") return false;
  return true;
}

export async function GET() {
  try {
    const userId = await requireAdminUserId();

    const env = {
      NEXT_PUBLIC_SUPABASE_URL: hasRealEnv("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasRealEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: hasRealEnv("SUPABASE_SERVICE_ROLE_KEY"),
    };

    const now = Date.now();
    const d24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [probe, tables] = await Promise.all([
      supabaseAdmin.from("users").select("id", { head: true, count: "exact" }).limit(1),
      probeTables(
        [
          { name: "users", probeColumn: "id", dateColumn: "created_at" },
          { name: "analytics_events", probeColumn: "id", dateColumn: "created_at" },
        ],
        d24,
        d7,
        d30,
      ),
    ]);

    const issues: string[] = [];
    const steps: string[] = [];

    for (const [k, v] of Object.entries(env)) {
      if (!v) {
        issues.push(`ENV missing: ${k}`);
        steps.push(`Добавь ${k} в Vercel -> Environment Variables и сделай redeploy`);
      }
    }

    if (probe.error) {
      issues.push(`DB connect failed: ${probe.error.message}`);
      steps.push("Проверь SUPABASE_SERVICE_ROLE_KEY и доступ проекта Supabase");
    }

    const missingTables = tables.filter((t) => !t.exists).map((t) => t.name);
    if (missingTables.length) {
      issues.push("Missing tables: " + missingTables.join(", "));
      steps.push("Создай отсутствующие таблицы через SQL миграции");
    }

    const okState = issues.length === 0;

    return ok({
      ok: okState,
      user_id: userId,
      env,
      db: {
        connected: !probe.error,
        error: probe.error?.message ?? null,
      },
      tables,
      issues,
      steps,
    });
  } catch (error) {
    return adminRouteError("/api/admin/health", error);
  }
}
