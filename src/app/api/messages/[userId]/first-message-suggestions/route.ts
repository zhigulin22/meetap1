import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { buildFirstMessageSuggestions } from "@/server/ai";
import { supabaseAdmin } from "@/supabase/admin";

const userIdParamSchema = z.string().uuid("Invalid target user");

type UserRow = {
  id: string;
  name: string;
  interests: string[] | null;
  hobbies: string[] | null;
  facts: string[] | null;
  university: string | null;
  work: string | null;
};

function mergeInterests(user: UserRow) {
  const raw = [...(user.interests ?? []), ...(user.hobbies ?? [])];
  const uniq = new Set<string>();
  for (const item of raw) {
    const value = String(item).trim();
    if (value) uniq.add(value);
  }
  return [...uniq].slice(0, 8);
}

function buildProfileSummary(user: UserRow) {
  const bits: string[] = [];
  if (user.university) bits.push(`Университет: ${user.university}`);
  if (user.work) bits.push(`Работа: ${user.work}`);
  if ((user.facts ?? []).length) bits.push(`Факты: ${user.facts?.slice(0, 2).join("; ")}`);
  return bits.join(". ").slice(0, 500);
}

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = requireUserId();
    const parsedTarget = userIdParamSchema.safeParse(params.userId);
    if (!parsedTarget.success) {
      return fail("Invalid target user", 422);
    }

    const targetUserId = parsedTarget.data;
    if (targetUserId === userId) {
      return fail("Нельзя писать самому себе", 422);
    }

    const [meRes, targetRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,name,interests,hobbies,facts,university,work")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id,name,interests,hobbies,facts,university,work")
        .eq("id", targetUserId)
        .maybeSingle(),
    ]);

    if (!meRes.data?.id || !targetRes.data?.id) {
      return fail("User not found", 404);
    }

    const me = meRes.data as UserRow;
    const target = targetRes.data as UserRow;

    const suggestions = await buildFirstMessageSuggestions({
      user1: {
        name: me.name,
        interests: mergeInterests(me),
        profileSummary: buildProfileSummary(me),
      },
      user2: {
        name: target.name,
        interests: mergeInterests(target),
        profileSummary: buildProfileSummary(target),
      },
      context: "Первое сообщение в личном чате Meetap.",
    });

    return ok({ items: suggestions.messages });
  } catch {
    return fail("Unauthorized", 401);
  }
}
