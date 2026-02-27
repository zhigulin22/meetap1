import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAdminUserId } from "@/server/admin";
import { getDevtoolsStatus, startSimulation } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";
import { assertSimulationTablesReady } from "@/server/admin-tables";
import { adminError, hasServiceRoleKey, mapSimError } from "@/server/admin-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  users_count: z.number().int().min(10).max(2000).default(40),
  interval_sec: z.number().int().min(3).max(120).default(8),
  mode: z.enum(["normal", "chaos"]).default("normal"),
  intensity: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin"]);

    if (!hasServiceRoleKey()) {
      return adminError(
        500,
        "SERVICE_ROLE_MISSING",
        "SUPABASE_SERVICE_ROLE_KEY is missing",
        "Добавь корректный SUPABASE_SERVICE_ROLE_KEY в env и redeploy.",
      );
    }

    const status = await getDevtoolsStatus();
    if (!status.enabled) {
      return adminError(
        403,
        "DEVTOOLS_DISABLED",
        `Devtools disabled: ${status.reason}`,
        "Включи ADMIN_DEVTOOLS_ENABLED=true или safe mode в system_settings.",
      );
    }

    await assertSimulationTablesReady();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return adminError(422, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Invalid payload", "Проверь параметры запуска симуляции.");
    }

    const run = await startSimulation({
      adminId,
      usersCount: parsed.data.users_count,
      intervalSec: parsed.data.interval_sec,
      mode: parsed.data.mode,
      intensity: parsed.data.intensity,
    });

    await logAdminAction({
      adminId,
      action: "simulation_start",
      targetType: "simulation",
      targetId: run.id,
      meta: parsed.data,
    });

    return NextResponse.json({ ok: true, run_id: run.id, status: run.status, run });
  } catch (error) {
    const mapped = mapSimError(error);
    return adminError(mapped.status, mapped.code, mapped.message, mapped.hint, error);
  }
}
