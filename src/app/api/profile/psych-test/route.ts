import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";
import { trackEvent } from "@/server/analytics";

type Answer = {
  id: string;
  trait: "openness" | "conscientiousness" | "extraversion" | "agreeableness" | "neuroticism";
  value: number;
  reverse?: boolean;
};

type OpenAnswers = {
  social_goal?: string;
  deal_breakers?: string;
  conversation_topics?: string;
};

function clamp(v: number) {
  return Math.max(1, Math.min(5, Math.round(v)));
}

function scoreAnswer(answer: Answer) {
  const value = clamp(answer.value);
  return answer.reverse ? 6 - value : value;
}

function buildProfile(answers: Answer[], openAnswers: OpenAnswers) {
  const sum: Record<Answer["trait"], number> = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };
  const count: Record<Answer["trait"], number> = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };

  for (const a of answers) {
    sum[a.trait] += scoreAnswer(a);
    count[a.trait] += 1;
  }

  const percent = (trait: Answer["trait"]) =>
    count[trait] ? Math.round(((sum[trait] / count[trait] - 1) / 4) * 100) : 50;

  const traits = {
    openness: percent("openness"),
    conscientiousness: percent("conscientiousness"),
    extraversion: percent("extraversion"),
    agreeableness: percent("agreeableness"),
    neuroticism: percent("neuroticism"),
  };

  let style = "Гибкий коммуникатор";
  if (traits.extraversion > 68 && traits.openness > 55) style = "Социальный исследователь";
  if (traits.agreeableness > 70 && traits.neuroticism < 45) style = "Тёплый эмпатичный собеседник";
  if (traits.conscientiousness > 70) style = "Структурный надёжный партнёр по диалогу";

  const recommendations = [
    traits.extraversion > 60
      ? "Начинай знакомство с живого контекста: событие, место, действие"
      : "Лучше начинать с короткой переписки и затем переходить в офлайн",
    traits.openness > 60
      ? "Используй новые темы и нестандартные вопросы"
      : "Используй понятные бытовые темы для первого контакта",
    traits.neuroticism > 60 ? "Снижать темп: мягкие формулировки, меньше давления" : "Можно быстрее предлагать конкретную встречу",
  ];

  return {
    instrument: "Big Five inspired short form",
    taken_at: new Date().toISOString(),
    style,
    traits,
    open_answers: {
      social_goal: (openAnswers.social_goal ?? "").trim().slice(0, 500),
      deal_breakers: (openAnswers.deal_breakers ?? "").trim().slice(0, 500),
      conversation_topics: (openAnswers.conversation_topics ?? "").trim().slice(0, 500),
    },
    recommendations,
  };
}

export async function GET() {
  try {
    const userId = requireUserId();

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("personality_profile,personality_updated_at")
      .eq("id", userId)
      .single();

    if (error) return fail(error.message, 500);

    const profile = data?.personality_profile as Record<string, unknown> | null;

    return ok({
      completed: Boolean(profile),
      updated_at: data?.personality_updated_at ?? null,
      style: typeof profile?.style === "string" ? profile.style : null,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const answers = (body?.answers ?? []) as Answer[];
    const openAnswers = (body?.openAnswers ?? {}) as OpenAnswers;

    if (!Array.isArray(answers) || answers.length < 10) {
      return fail("Недостаточно ответов для психотеста", 422);
    }

    const valid = answers.every(
      (x: any) =>
        x &&
        typeof x.id === "string" &&
        ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"].includes(x.trait) &&
        Number.isFinite(x.value),
    );

    if (!valid) {
      return fail("Неверные данные теста", 422);
    }

    const profile = buildProfile(answers, openAnswers);

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

    await trackEvent({
      eventName: "profile.psychotest_completed",
      userId,
      path: "/profile/psych-test",
      properties: { style: profile.style },
    });

    return ok({ profile });
  } catch {
    return fail("Unauthorized", 401);
  }
}
