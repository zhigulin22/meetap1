import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { ADMIN_SCHEMA_TABLES, getSchemaSnapshot } from "@/server/schema-introspect";

export async function GET() {
  try {
    await requireAdminUserId(["admin"]);
    const schema = await getSchemaSnapshot(ADMIN_SCHEMA_TABLES);
    return ok(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    if (message === "Forbidden") return fail("Forbidden", 403);
    return fail(message, 400);
  }
}
