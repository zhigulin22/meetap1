import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

type Answer = {
  id: string;
  value: number;
};

function clamp(v: number) {
  return Math.max(1, Math.min(5, v));
}

function buildProfile(answers: Answer[]) {
  const get = (id: string) => clamp(answers.find((x) => x.id === id)?.value ?? 3);

  const openness = Math.round(((get("new") + get("culture") + get("ideas")) / 15) * 100);
  const sociability = Math.round(((get("people") + get("group") + get("energy")) / 15) * 100);
  const depth = Math.round(((get("listen") + get("meaning") + get("care")) / 15) * 100);
  const pace = Math.round(((get("fast") + get("plan") + get("initiative")) / 15) * 100);

  const style =
    sociability > 70
      ? "Активный социальный тип"
      : depth > 70
        ? "Глубокий эмпатичный тип"
        : openness > 70
          ? "Исследовательский тип"
          : "Сбалансированный тип";

  return {
    style,
    openness,
    sociability,
    depth,
    pace,
    recommendations: [
      sociability > 65
        ? "Лучше знакомиться через живые групповые активности"
        : "Лучше знакомиться через камерные встречи 1:1",
      depth > 65
        ? "Начинай разговор с личных смыслов и опыта"
        : "Начинай с легкого контекста: событие, хобби, город",
      pace > 65
        ? "Предлагай конкретный следующий шаг сразу"
        : "Дай время на переписку перед офлайн встречей",
    ],
  };
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const answers = (body?.answers ?? []) as Answer[];

    if (!Array.isArray(answers) || answers.length < 9) {
      return fail("Недостаточно ответов для теста", 422);
    }

    const profile = buildProfile(answers);

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        personality_profile: profile,
        personality_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      if (error.message.toLowerCase().includes("personality_profile")) {
        return fail("Не применена миграция personality_profile", 500);
      }
      return fail(error.message, 500);
    }

    return ok({ profile });
  } catch {
    return fail("Unauthorized", 401);
  }
}
