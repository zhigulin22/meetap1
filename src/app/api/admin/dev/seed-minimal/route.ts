import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import {
  clearSeedDemoData,
  getSeedMinimalStatus,
  seedMinimalData,
} from "@/server/seed-minimal";

export async function POST() {
  try {
    const adminId = await requireAdminUserId();
    const status = getSeedMinimalStatus();
    if (!status.enabled) return fail(`Seed disabled: ${status.reason}`, 403);

    const res = await seedMinimalData();

    await logAdminAction({
      adminId,
      action: "seed_minimal",
      targetType: "system",
      meta: res,
    });

    return ok({ success: true, ...res, status });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function DELETE() {
  try {
    const adminId = await requireAdminUserId();
    const status = getSeedMinimalStatus();
    if (!status.enabled) return fail(`Seed disabled: ${status.reason}`, 403);

    const res = await clearSeedDemoData();

    await logAdminAction({
      adminId,
      action: "seed_minimal_clear",
      targetType: "system",
      meta: res,
    });

    return ok({ success: true, ...res, status });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
