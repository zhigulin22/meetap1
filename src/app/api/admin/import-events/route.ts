import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { adminRouteError } from "@/server/admin-error";
import { runEventsImport } from "@/server/events-import";
import { busyResponse, withConcurrencyLimit } from "@/server/runtime-guard";

const bodySchema = z.object({
  categories: z.array(z.string().min(2)).max(12).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  days_ahead: z.coerce.number().int().min(7).max(90).optional(),
  force_seed: z.coerce.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId(["admin", "super_admin"]);

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422, {
        code: "VALIDATION",
        endpoint: "/api/admin/import-events",
      });
    }

    try {
      const result = await withConcurrencyLimit("admin:import-events", 1, async () => {
        return runEventsImport({
          actorUserId: adminId,
          categories: parsed.data.categories,
          city: parsed.data.city,
          daysAhead: parsed.data.days_ahead,
          forceSeed: parsed.data.force_seed,
          sourceName: "kudago_timepad",
        });
      });

      await logAdminAction({
        adminId,
        action: "import_events",
        targetType: "events",
        targetId: result.job_id,
        meta: {
          categories: parsed.data.categories ?? null,
          city: parsed.data.city ?? null,
          days_ahead: parsed.data.days_ahead ?? null,
          force_seed: parsed.data.force_seed ?? false,
          source: result.source,
          imported_count: result.imported_count,
          seeded_count: result.seeded_count,
          warnings: result.warnings,
          errors: result.errors,
        },
      });

      return ok(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("BUSY:")) {
        return busyResponse("/api/admin/import-events");
      }
      throw error;
    }
  } catch (error) {
    return adminRouteError("/api/admin/import-events", error);
  }
}
