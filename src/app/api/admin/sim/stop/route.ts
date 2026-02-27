import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAdminUserId } from "@/server/admin";
import { stopSimulation } from "@/server/simulation";
import { logAdminAction } from "@/server/admin-audit";
import { adminError, hasServiceRoleKey, mapSimError } from "@/server/admin-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ run_id: z.string().uuid().optional() });

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

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return adminError(422, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Invalid payload", "Проверь run_id.");
    }

    await stopSimulation(parsed.data.run_id);

    await logAdminAction({
      adminId,
      action: "simulation_stop",
      targetType: "simulation",
      targetId: parsed.data.run_id,
    });

    return NextResponse.json({ ok: true, status: "stopped" });
  } catch (error) {
    const mapped = mapSimError(error);
    return adminError(mapped.status, mapped.code, mapped.message, mapped.hint, error);
  }
}
