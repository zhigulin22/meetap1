import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdminUserId } from "@/server/admin";
import { logAdminAction } from "@/server/admin-audit";
import { addSupportNote, listSupportNotes, updateSupportNoteStatus } from "@/server/support-store";
import { supabaseAdmin } from "@/supabase/admin";

const createSchema = z.object({
  user_id: z.string().uuid(),
  text: z.string().trim().min(2).max(1000),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "closed"]),
});

export async function GET(req: Request) {
  try {
    await requireAdminUserId(["admin", "moderator", "support"]);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id") ?? undefined;
    const notes = await listSupportNotes(userId);
    return ok({ items: notes });
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

    const actor = await supabaseAdmin.from("users").select("role").eq("id", actorId).maybeSingle();
    const role = String(actor.data?.role ?? "support");

    const item = await addSupportNote({
      user_id: parsed.data.user_id,
      text: parsed.data.text,
      author_id: actorId,
      author_role: role,
    });

    await logAdminAction({
      adminId: actorId,
      action: "support_note_add",
      targetType: "user",
      targetId: parsed.data.user_id,
      meta: { note_id: item.id },
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

    const item = await updateSupportNoteStatus({ id: parsed.data.id, status: parsed.data.status, actor_id: actorId });
    await logAdminAction({
      adminId: actorId,
      action: "support_note_status",
      targetType: "support_note",
      targetId: parsed.data.id,
      meta: { status: parsed.data.status },
    });
    return ok({ success: true, item });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden", 403);
  }
}
