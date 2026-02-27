import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { getQaBotsStatus } from "@/server/qa-bots";

export async function GET() {
  try {
    await requireAdminUserId(["admin", "analyst", "moderator"]);
    const status = await getQaBotsStatus();
    return ok(status);
  } catch {
    return fail("Forbidden", 403);
  }
}
