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
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function normalizeFaceResult(value: unknown): FaceValidation {
  if (!value || typeof value !== "object") {
    return { faces_count: 0, confidence: 0, ok: false, reason: "Invalid AI response" };
  }

  const raw = value as Record<string, unknown>;
  const faces = Math.max(0, Number(raw.faces_count ?? 0));
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0)));
  const ok = Boolean(raw.ok) && Number.isFinite(faces) && confidence >= 0.45;
  const reason = typeof raw.reason === "string" ? raw.reason : undefined;

  return {
    faces_count: Number.isFinite(faces) ? Math.round(faces) : 0,
    confidence,
    ok,
    reason,
  };
}

export async function validateFaces(input: { imageUrl?: string; base64?: string }) {
  const fallback: FaceValidation = {
    faces_count: 0,
    confidence: 0,
    ok: false,
    reason: "AI unavailable",
  };

  if (!input.imageUrl && !input.base64) {
    return { ...fallback, reason: "Image is required" };
  }

  try {
    const client = getClient();

    const content = input.imageUrl
      ? [
          {
            type: "input_text",
            text: "Detect visible real human faces in this image. Return strict JSON only.",
          },
          { type: "input_image", image_url: input.imageUrl },
        ]
      : [
          {
            type: "input_text",
            text: "Detect visible real human faces in this image. Return strict JSON only.",
          },
          { type: "input_image", image_url: `data:image/jpeg;base64,${input.base64}` },
        ];

    const aiResult = await Promise.race([
      client.responses.create({
        model: "gpt-4o-mini",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "face_validation",
            schema: {
              type: "object",
              properties: {
                faces_count: { type: "number" },
                confidence: { type: "number" },
                ok: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["faces_count", "confidence", "ok"],
              additionalProperties: false,
            },
          },
        },
      } as any),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]);

    if (!aiResult) {
      return { ...fallback, reason: "AI timeout" };
    }

    const parsed = JSON.parse(aiResult.output_text);
    return normalizeFaceResult(parsed);
  } catch {
    return fallback;
  }
}

export async function buildIcebreaker(input: {
  user1: { name: string; interests: string[] };
  user2: { name: string; interests: string[] };
  context?: string;
}) {
  try {
    const client = getClient();
    const prompt = `
Ты помощник по знакомствам. Ответ только JSON.
Сделай рекомендации для ${input.user1.name}, чтобы познакомиться с ${input.user2.name}.
Контекст: ${input.context ?? "offline meeting"}
Интересы ${input.user1.name}: ${input.user1.interests.join(", ") || "не указаны"}
Интересы ${input.user2.name}: ${input.user2.interests.join(", ") || "не указаны"}
`;

    const res = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "icebreakers",
          schema: {
            type: "object",
            properties: {
              messages: { type: "array", items: { type: "string" } },
              topic: { type: "string" },
              question: { type: "string" },
              profileSummary: { type: "string" },
              approachTips: { type: "array", items: { type: "string" } },
              offlineIdeas: { type: "array", items: { type: "string" } },
              onlineIdeas: { type: "array", items: { type: "string" } },
            },
            required: ["messages", "topic", "question"],
            additionalProperties: false,
          },
        },
      },
    } as any);

    return JSON.parse(res.output_text) as {
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
