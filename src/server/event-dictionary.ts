export type EventDictionaryItem = {
  event_name: string;
  family: "auth" | "profile" | "feed" | "events" | "social" | "safety" | "ai" | "admin";
  display_ru: string;
  metric_tags: string[];
  is_key: boolean;
  aliases: string[];
};

export const EVENT_DICTIONARY: EventDictionaryItem[] = [
  {
    event_name: "register_started",
    family: "auth",
    display_ru: "Регистрация начата",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["register_started", "auth_register_started"],
  },
  {
    event_name: "telegram_verified",
    family: "auth",
    display_ru: "Телеграм верификация",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["telegram_verified", "tg_verified", "phone_verified"],
  },
  {
    event_name: "registration_completed",
    family: "auth",
    display_ru: "Регистрация завершена",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["registration_completed", "register_completed"],
  },
  {
    event_name: "profile_completed",
    family: "profile",
    display_ru: "Профиль заполнен",
    metric_tags: ["activation", "funnel_profile"],
    is_key: true,
    aliases: ["profile_completed", "profile_done"],
  },
  {
    event_name: "post_published_daily_duo",
    family: "feed",
    display_ru: "Пост Daily Duo",
    metric_tags: ["content", "posts"],
    is_key: true,
    aliases: ["post_published_daily_duo", "daily_duo_published", "daily_duo_posted"],
  },
  {
    event_name: "post_published_video",
    family: "feed",
    display_ru: "Видео пост",
    metric_tags: ["content", "posts"],
    is_key: true,
    aliases: ["post_published_video", "video_post_published", "reel_published"],
  },
  {
    event_name: "event_viewed",
    family: "events",
    display_ru: "Просмотр события",
    metric_tags: ["events"],
    is_key: true,
    aliases: ["event_viewed", "events_viewed", "event_opened"],
  },
  {
    event_name: "event_joined",
    family: "events",
    display_ru: "Вступление в событие",
    metric_tags: ["events", "funnel_events"],
    is_key: true,
    aliases: ["event_joined", "event_member_added", "first_event_join", "event_join"],
  },
  {
    event_name: "connect_sent",
    family: "social",
    display_ru: "Connect отправлен",
    metric_tags: ["social", "funnel_social"],
    is_key: true,
    aliases: ["connect_sent", "connect_clicked", "connect_request_sent"],
  },
  {
    event_name: "connect_replied",
    family: "social",
    display_ru: "Ответ на connect",
    metric_tags: ["social", "funnel_social"],
    is_key: true,
    aliases: ["connect_replied", "first_message_sent", "connect_reply"],
  },
  {
    event_name: "message_sent",
    family: "social",
    display_ru: "Сообщение в чате",
    metric_tags: ["social", "engagement", "wmc"],
    is_key: true,
    aliases: ["message_sent", "chat_message_sent", "chat_sent"],
  },
  {
    event_name: "report_created",
    family: "safety",
    display_ru: "Жалоба создана",
    metric_tags: ["safety"],
    is_key: true,
    aliases: ["report_created", "report_submitted"],
  },
  {
    event_name: "ai_cost",
    family: "ai",
    display_ru: "AI cost",
    metric_tags: ["ai", "cost"],
    is_key: true,
    aliases: ["ai_cost", "ai_request_cost"],
  },
  {
    event_name: "ai_error",
    family: "ai",
    display_ru: "AI error",
    metric_tags: ["ai", "health"],
    is_key: true,
    aliases: ["ai_error", "ai_request_fail", "ai_timeout"],
  },
  {
    event_name: "admin_test_event",
    family: "admin",
    display_ru: "Admin test event",
    metric_tags: ["health", "diagnostics"],
    is_key: false,
    aliases: ["admin_test_event"],
  },
];

const aliasToCanonical = new Map<string, string>();
for (const item of EVENT_DICTIONARY) {
  for (const alias of item.aliases) aliasToCanonical.set(alias, item.event_name);
}

export function canonicalizeEventName(eventName: string | null | undefined) {
  if (!eventName) return "unknown";
  return aliasToCanonical.get(eventName) ?? eventName;
}

export function aliasesForCanonical(canonical: string) {
  const item = EVENT_DICTIONARY.find((x) => x.event_name === canonical);
  return item?.aliases ?? [canonical];
}

export function aliasesForCanonicals(canonicals: string[]) {
  const out = new Set<string>();
  for (const canonical of canonicals) {
    for (const alias of aliasesForCanonical(canonical)) out.add(alias);
  }
  return [...out];
}

export function knownEventNames() {
  return [...aliasToCanonical.keys()];
}

export function eventDictionarySeedRows() {
  return EVENT_DICTIONARY.map((x) => ({
    event_name: x.event_name,
    family: x.family,
    display_ru: x.display_ru,
    metric_tags: x.metric_tags,
    is_key: x.is_key,
    aliases: x.aliases,
  }));
}

const METRIC_CANONICAL: Record<string, string[]> = {
  dau: ["event_viewed", "event_joined", "post_published_daily_duo", "post_published_video", "connect_sent", "connect_replied", "message_sent"],
  new_users: ["registration_completed"],
  tg_verify_rate_num: ["telegram_verified"],
  tg_verify_rate_den: ["register_started"],
  posts: ["post_published_daily_duo", "post_published_video"],
  event_joins: ["event_joined"],
  connect_replied: ["connect_replied"],
  reports: ["report_created"],
  ai_cost: ["ai_cost"],
  events: ["event_viewed", "event_joined"],
};

export function aliasesForMetric(metric: string) {
  const canonicals = METRIC_CANONICAL[metric] ?? METRIC_CANONICAL.posts;
  return aliasesForCanonicals(canonicals);
}

export function canonicalsForMetric(metric: string) {
  return METRIC_CANONICAL[metric] ?? METRIC_CANONICAL.posts;
}
