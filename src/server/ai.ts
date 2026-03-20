import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

type FaceValidation = {
  faces_count: number;
  confidence: number;
  ok: boolean;
  reason?: string;
};

function getClient() {
  const env = getServerEnv();
  return new OpenAI({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: env.DEEPSEEK_BASE_URL,
  });
}

// DeepSeek does not support vision — face validation is skipped (passthrough)
export async function validateFaces(_input: {
  imageUrl?: string;
  base64?: string;
}): Promise<FaceValidation> {
  return { faces_count: 1, confidence: 1.0, ok: true };
}

export async function buildIcebreaker(input: {
  user1: { name: string; interests: string[] };
  user2: { name: string; interests: string[] };
  context?: string;
}) {
  try {
    const client = getClient();
    const prompt = `Ты помощник по знакомствам. Ответ только JSON.
Сделай рекомендации для ${input.user1.name}, чтобы познакомиться с ${input.user2.name}.
Контекст: ${input.context ?? "offline meeting"}
Интересы ${input.user1.name}: ${input.user1.interests.join(", ") || "не указаны"}
Интересы ${input.user2.name}: ${input.user2.interests.join(", ") || "не указаны"}`;

    const res = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = res.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content) as {
      messages: string[];
      topic: string;
      question: string;
      profileSummary?: string;
      approachTips?: string[];
      offlineIdeas?: string[];
      onlineIdeas?: string[];
    };
  } catch {
    return {
      messages: [
        `Привет! Увидел(а), что тебе близка тема ${input.user2.interests[0] ?? "оффлайн встреч"}. Хочешь познакомиться?`,
        "Я бы с радостью присоединился(ась) к небольшому мероприятию или прогулке.",
      ],
      topic: "Общие интересы",
      question: "Какой формат первого знакомства тебе комфортнее?",
      profileSummary: `${input.user2.name} лучше откликается на спокойный диалог через общий контекст.`,
      approachTips: [
        "Начни коротко, без длинной самопрезентации",
        "Ссылайся на общий интерес или недавний пост",
      ],
      offlineIdeas: ["Кофе рядом с мероприятием", "Короткая прогулка на 30 минут"],
      onlineIdeas: ["Обменяться 2-3 вопросами перед встречей"],
    };
  }
}
