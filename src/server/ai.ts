import { getServerEnv } from "@/lib/env";

type FaceValidation = {
  faces_count: number;
  confidence: number;
  ok: boolean;
  reason?: string;
};

type IcebreakerResponse = {
  messages: string[];
  topic: string;
  question: string;
  profileSummary?: string;
  approachTips?: string[];
  offlineIdeas?: string[];
  onlineIdeas?: string[];
};

type FirstMessageSuggestionsResponse = {
  messages: string[];
};

const FACE_TIMEOUT_MS = 12_000;
const ICEBREAKER_TIMEOUT_MS = 15_000;
const FIRST_MESSAGE_TIMEOUT_MS = 12_000;

function normalizeFaceResult(value: unknown, minConfidence: number): FaceValidation {
  if (!value || typeof value !== "object") {
    return { faces_count: 0, confidence: 0, ok: false, reason: "Invalid AI response" };
  }

  const raw = value as Record<string, unknown>;
  const faces = Math.max(0, Number(raw.faces_count ?? 0));
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0)));
  const ok = Boolean(raw.ok) && Number.isFinite(faces) && confidence >= minConfidence;
  const reason = typeof raw.reason === "string" ? raw.reason : undefined;

  return {
    faces_count: Number.isFinite(faces) ? Math.round(faces) : 0,
    confidence,
    ok,
    reason,
  };
}

function stripTrailingSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function callAiService<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const env = getServerEnv();
  const baseUrl = stripTrailingSlash(env.AI_SERVICE_URL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI service failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateFaces(input: { imageUrl?: string; base64?: string }) {
  const env = getServerEnv();
  const minConfidence = env.FACE_DETECT_MIN_CONFIDENCE;

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
    const ai = await callAiService<FaceValidation>(
      "/v1/face-validate",
      {
        image_url: input.imageUrl,
        base64: input.base64,
      },
      FACE_TIMEOUT_MS,
    );

    return normalizeFaceResult(ai, minConfidence);
  } catch {
    return fallback;
  }
}

export async function buildIcebreaker(input: {
  user1: { name: string; interests: string[] };
  user2: { name: string; interests: string[] };
  context?: string;
}) {
  const fallback: IcebreakerResponse = {
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

  try {
    const ai = await callAiService<Partial<IcebreakerResponse>>(
      "/v1/icebreaker",
      {
        user1: input.user1,
        user2: input.user2,
        context: input.context,
      },
      ICEBREAKER_TIMEOUT_MS,
    );

    if (!Array.isArray(ai.messages) || !ai.topic || !ai.question) {
      return fallback;
    }

    return {
      messages: ai.messages.map((x) => String(x)).slice(0, 6),
      topic: String(ai.topic),
      question: String(ai.question),
      profileSummary: ai.profileSummary ? String(ai.profileSummary) : undefined,
      approachTips: Array.isArray(ai.approachTips) ? ai.approachTips.map(String).slice(0, 8) : undefined,
      offlineIdeas: Array.isArray(ai.offlineIdeas) ? ai.offlineIdeas.map(String).slice(0, 8) : undefined,
      onlineIdeas: Array.isArray(ai.onlineIdeas) ? ai.onlineIdeas.map(String).slice(0, 8) : undefined,
    };
  } catch {
    return fallback;
  }
}

export async function buildFirstMessageSuggestions(input: {
  user1: { name: string; interests: string[]; profileSummary?: string };
  user2: { name: string; interests: string[]; profileSummary?: string };
  context?: string;
}) {
  const myTopic = input.user1.interests[0] ?? "новые знакомства";
  const baseTopic = input.user2.interests[0] ?? "знакомство";
  const fallback: FirstMessageSuggestionsResponse = {
    messages: [
      `Привет! Пишу познакомиться. Как проходит твой день?`,
      `Привет! Мне близка тема ${myTopic}, поэтому решил написать. Если комфортно, давай познакомимся.`,
      `Привет! Вижу, тебе близка тема ${baseTopic}. Что тебе в ней сейчас больше всего нравится?`,
    ],
  };

  try {
    const ai = await callAiService<Partial<FirstMessageSuggestionsResponse>>(
      "/v1/first-message-suggestions",
      {
        user1: input.user1,
        user2: input.user2,
        context: input.context,
      },
      FIRST_MESSAGE_TIMEOUT_MS,
    );

    if (!Array.isArray(ai.messages)) {
      return fallback;
    }

    // Возвращаем ровно то, что вернул AI service (без дополнительной нормализации на стороне Next.js).
    return { messages: ai.messages };
  } catch {
    return fallback;
  }
}
