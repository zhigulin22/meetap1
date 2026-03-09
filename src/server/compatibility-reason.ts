type ReasonSource = "ai" | "fallback";

type ReasonPayload = {
  v?: number;
  reason?: string;
  first_messages?: string[];
  first_messages_updated_at?: string;
  compatibility_source?: ReasonSource;
  first_messages_source?: ReasonSource;
};

export type ParsedCompatibilityReason = {
  reason: string;
  firstMessages: string[];
  firstMessagesUpdatedAt?: string;
  compatibilitySource?: ReasonSource;
  firstMessagesSource?: ReasonSource;
};

function normalizeText(value: unknown, maxLen: number) {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLen);
}

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  const uniq = new Set<string>();
  for (const item of value) {
    const text = normalizeText(item, 280);
    if (!text) continue;
    uniq.add(text);
  }
  return [...uniq].slice(0, 3);
}

export function parseCompatibilityReason(raw: string | null | undefined): ParsedCompatibilityReason {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { reason: "", firstMessages: [] };
  }

  if (!text.startsWith("{")) {
    return { reason: normalizeText(text, 240), firstMessages: [] };
  }

  try {
    const parsed = JSON.parse(text) as ReasonPayload;
    const reason = normalizeText(parsed.reason, 240) || normalizeText(text, 240);
    return {
      reason,
      firstMessages: normalizeMessages(parsed.first_messages),
      firstMessagesUpdatedAt: normalizeText(parsed.first_messages_updated_at, 80) || undefined,
      compatibilitySource:
        parsed.compatibility_source === "ai" || parsed.compatibility_source === "fallback"
          ? parsed.compatibility_source
          : undefined,
      firstMessagesSource:
        parsed.first_messages_source === "ai" || parsed.first_messages_source === "fallback"
          ? parsed.first_messages_source
          : undefined,
    };
  } catch {
    return { reason: normalizeText(text, 240), firstMessages: [] };
  }
}

export function buildCompatibilityReason(args: {
  reason: string;
  firstMessages?: string[];
  firstMessagesUpdatedAt?: string;
  compatibilitySource?: ReasonSource;
  firstMessagesSource?: ReasonSource;
}) {
  const payload: ReasonPayload = {
    v: 1,
    reason: normalizeText(args.reason, 240),
  };

  const firstMessages = normalizeMessages(args.firstMessages);
  if (firstMessages.length) {
    payload.first_messages = firstMessages;
    payload.first_messages_updated_at = normalizeText(
      args.firstMessagesUpdatedAt ?? new Date().toISOString(),
      80,
    );
    if (args.firstMessagesSource) payload.first_messages_source = args.firstMessagesSource;
  }

  if (args.compatibilitySource) payload.compatibility_source = args.compatibilitySource;
  return JSON.stringify(payload);
}
