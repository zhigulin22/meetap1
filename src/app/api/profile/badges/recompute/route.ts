import { fail, ok } from "@/lib/http";
import { recomputeBadgesForUser } from "@/server/badges-progress";
import { requireUserId } from "@/server/auth";

export async function POST() {
  try {
    const userId = requireUserId();
    const result = await recomputeBadgesForUser(userId);

    return ok({
      success: true,
      earned_count: result.earnedCount,
      total_count: result.totalCount,
      updated_at: new Date().toISOString(),
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
