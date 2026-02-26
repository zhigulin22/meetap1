import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { getDevtoolsStatus, seedMinimalData } from "@/server/simulation";

export async function POST() {
  try {
    const adminId = await requireAdminUserId();
    const status = getDevtoolsStatus();
    if (!status.enabled) return fail(`Devtools disabled: ${status.reason}`, 403);

    const res = await seedMinimalData();

    await logAdminAction({
      adminId,
      action: "seed_minimal",
      targetType: "system",
      meta: res,
    });

    return ok({ success: true, ...res });
  } catch {
    return fail("Forbidden", 403);
  }
}
