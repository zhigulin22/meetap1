import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { createMissingAdminTables } from "@/server/admin-tables";

export async function POST() {
  try {
    const adminId = await requireAdminUserId(["admin"]);

    const result = await createMissingAdminTables();

    await logAdminAction({
      adminId,
      action: "fix_create_missing_tables",
      targetType: "system",
      meta: result,
    });

    if (!result.tables_present) {
      return fail(
        `Не удалось подтвердить таблицы после фикса: ${result.missing_after.join(", ")}`,
        500,
      );
    }

    return ok({
      created: true,
      tables_present: true,
      missing_before: result.missing_before,
      missing_after: result.missing_after,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create missing tables";
    if (message === "Forbidden") return fail(message, 403);
    return fail(message, 500);
  }
}
