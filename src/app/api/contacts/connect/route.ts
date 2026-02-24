import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { requireUserId } from "@/server/auth";
import { buildIcebreaker } from "@/server/ai";

type UserLite = {
  id: string;
  name: string;
  interests: string[] | null;
  hobbies: string[] | null;
};

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
        supabaseAdmin.from("users").select("id,name,interests,hobbies").eq("id", userId).single(),
        supabaseAdmin.from("users").select("id,name,interests,hobbies").eq("id", targetUserId).single(),
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
    const common = myInterests.filter((i) => targetInterests.includes(i));

    const myEventSet = new Set((myEvents ?? []).map((x) => x.event_id));
    const sharedEvents = (targetEvents ?? []).filter((x) => myEventSet.has(x.event_id)).length;

    const behaviorSignals = [
      common.length ? `общие интересы: ${common.slice(0, 4).join(", ")}` : "интересы пока не пересекаются",
      sharedEvents > 0 ? `совпадение по событиям: ${sharedEvents}` : "пока без общих событий",
      `мои реакции: ${(myReactions ?? []).map((x) => x.reaction_type).slice(0, 5).join(", ") || "нет"}`,
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

    const fallbackOffline = [
      "Начни с короткой встречи на 20-30 минут в нейтральном месте",
      "Опирайся на общий интерес из профиля и предложи конкретный формат",
    ];

    const fallbackOnline = [
      "Напиши коротко: кто ты и почему решил(а) познакомиться",
      "Задай один открытый вопрос вместо длинного сообщения",
    ];

    return ok({
      success: true,
      common,
      icebreaker: {
        ...ai,
        profileSummary:
          common.length > 0
            ? `${targetUser.name} чаще откликается на темы: ${common.slice(0, 3).join(", ")}.`
            : `${targetUser.name} любит новые знакомства, лучше начать с мягкого нейтрального вопроса.`,
        sharedSignals: behaviorSignals,
        approachTips: [
          "Начни с контекста поста или события, а не с формального приветствия",
          "Пиши короткими сообщениями, без перегруза",
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
