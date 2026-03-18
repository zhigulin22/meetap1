import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { createSupportTicket, listSupportTickets, updateSupportTicket } from "@/server/support-store";

const createSchema = z.object({
  user_id: z.string().uuid(),
  category: z.string().trim().min(2).max(120),
  assignee: z.string().trim().max(120).optional().nullable(),
  internal_note: z.string().trim().max(1200).optional().nullable(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  assignee: z.string().trim().max(120).optional().nullable(),
  internal_note: z.string().trim().max(1200).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "support"]);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id") ?? undefined;
    const items = await listSupportTickets(userId);
    return ok({ items });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function POST(req: Request) {
  try {
    const actorId = await requireAdminUserId(["admin", "moderator", "support"]);
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const item = await createSupportTicket({
      user_id: parsed.data.user_id,
      category: parsed.data.category,
      assignee: parsed.data.assignee ?? null,
      internal_note: parsed.data.internal_note ?? null,
      actor_id: actorId,
    });

    await logAdminAction({
      adminId: actorId,
      action: "support_ticket_create",
      targetType: "user",
      targetId: parsed.data.user_id,
      meta: { ticket_id: item.id, category: item.category },
    });

    return ok({ success: true, item });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}

export async function PUT(req: Request) {
  try {
    const actorId = await requireAdminUserId(["admin", "moderator", "support"]);
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

    const item = await updateSupportTicket({
      id: parsed.data.id,
      status: parsed.data.status,
      assignee: parsed.data.assignee,
      internal_note: parsed.data.internal_note,
      actor_id: actorId,
    });

    await logAdminAction({
      adminId: actorId,
      action: "support_ticket_update",
      targetType: "support_ticket",
      targetId: parsed.data.id,
      meta: {
        status: parsed.data.status ?? null,
        assignee: parsed.data.assignee ?? null,
      },
    });

    return ok({ success: true, item });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
