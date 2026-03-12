import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { buildIcebreaker } from "@/server/ai";
import { trackEvent } from "@/server/analytics";

type UserLite = {
  id: string;
  name: string;
  interests: string[] | null;
  hobbies: string[] | null;
  level?: number | null;
};

function pickStatus(user: UserLite, sharedCount: number) {
  const catalog = [
    "Открыт к легкому знакомству",
    "Любит умные разговоры",
    "Лучше раскрывается офлайн",
    "Часто отвечает на короткие сообщения",
    "Комфортен в дружелюбном темпе",
    "Энергия: спокойный интроверт",
    "Энергия: активный экстраверт",
  ];

  const key = [...user.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = catalog[key % catalog.length];
  const overlay = sharedCount > 0 ? "Есть общие интересы" : "Подойдет мягкий первый заход";
  return `${base} · ${overlay}`;
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = await req.json().catch(() => null);
    const targetUserId = String(body?.targetUserId ?? "");
    const context = String(body?.context ?? "").slice(0, 400);

    if (!targetUserId || targetUserId === userId) {
      return fail("Invalid target user", 422);
    }

    const [{ data: me }, { data: target }, { data: myEvents }, { data: targetEvents }, { data: myReactions }] =
      await Promise.all([
        supabaseAdmin.from("users").select("id,name,interests,hobbies,level").eq("id", userId).single(),
        supabaseAdmin.from("users").select("id,name,interests,hobbies,level").eq("id", targetUserId).single(),
        supabaseAdmin.from("event_members").select("event_id").eq("user_id", userId),
        supabaseAdmin.from("event_members").select("event_id").eq("user_id", targetUserId),
        supabaseAdmin.from("reactions").select("reaction_type").eq("user_id", userId).limit(120),
      ]);

    if (!me || !target) {
      return fail("Users not found", 404);
    }

    const meUser = me as UserLite;
    const targetUser = target as UserLite;

    const myInterests = [...(meUser.interests ?? []), ...(meUser.hobbies ?? [])];
    const targetInterests = [...(targetUser.interests ?? []), ...(targetUser.hobbies ?? [])];
    const common = myInterests.filter((i: any) => targetInterests.includes(i));

    const myEventSet = new Set((myEvents ?? []).map((x: any) => x.event_id));
    const sharedEvents = (targetEvents ?? []).filter((x: any) => myEventSet.has(x.event_id)).length;

    const behaviorSignals = [
      common.length ? `общие интересы: ${common.slice(0, 4).join(", ")}` : "интересы пока не пересекаются",
      sharedEvents > 0 ? `совпадение по событиям: ${sharedEvents}` : "пока без общих событий",
      `мои реакции: ${(myReactions ?? []).map((x: any) => x.reaction_type).slice(0, 5).join(", ") || "нет"}`,
    ];

    const ai = await buildIcebreaker({
      user1: { name: meUser.name, interests: myInterests },
      user2: { name: targetUser.name, interests: targetInterests },
      context: `${context || "знакомство из ленты"}. Сигналы: ${behaviorSignals.join("; ")}.`,
    });

    await supabaseAdmin.from("connections").insert({
      from_user_id: userId,
      to_user_id: targetUserId,
      status: "pending",
    });

    const firstMessages = [
      `Привет, ${targetUser.name}! Видел твой пост, зацепила тема ${common[0] || "оффлайн-встреч"}. Хочешь познакомиться?`,
      `Привет! Я тоже интересуюсь ${common[1] || "новыми людьми"}. Как смотришь на короткий созвон/кофе?`,
      `Привет, давай познакомимся. Что тебя сейчас больше заряжает: события, спорт или творчество?`,
    ];

    const fallbackOffline = [
      "Предложи короткую встречу на 20-30 минут в месте с нейтральной атмосферой",
      "Используй общий контекст (ивент/пост), не начинай с длинного рассказа о себе",
    ];

    const fallbackOnline = [
      "1 сообщение = 1 мысль. Коротко и уважительно",
      "Задай один открытый вопрос и подожди реакцию",
    ];

    await trackEvent({ eventName: "chat.connect_sent", userId, path: "/feed", properties: { targetUserId } });

    return ok({
      success: true,
      common,
      icebreaker: {
        ...ai,
        vibeStatus: pickStatus(targetUser, common.length),
        profileSummary:
          common.length > 0
            ? `${targetUser.name} чаще откликается на темы: ${common.slice(0, 3).join(", ")}.`
            : `${targetUser.name} лучше знакомится через мягкий, спокойный старт разговора.`,
        firstMessages,
        sharedSignals: behaviorSignals,
        approachTips: [
          "Начни с контекста поста или события, а не с формального приветствия",
          "Пиши коротко, не более 2-3 предложений в первом сообщении",
          "Предложи понятный следующий шаг: кофе, прогулка или ивент",
        ],
        offlineIdeas: fallbackOffline,
        onlineIdeas: fallbackOnline,
      },
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
