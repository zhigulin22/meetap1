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
    event_name: "app.session_start",
    family: "admin",
    display_ru: "Сессия приложения",
    metric_tags: ["engagement", "session"],
    is_key: true,
    aliases: ["app.session_start", "session_start", "app_session_start"],
  },
  {
    event_name: "auth.register_started",
    family: "auth",
    display_ru: "Регистрация начата",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["auth.register_started", "register_started", "auth_register_started"],
  },
  {
    event_name: "auth.telegram_verified",
    family: "auth",
    display_ru: "Телеграм верификация",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["auth.telegram_verified", "telegram_verified", "tg_verified", "phone_verified"],
  },
  {
    event_name: "auth.registration_completed",
    family: "auth",
    display_ru: "Регистрация завершена",
    metric_tags: ["growth", "funnel_auth"],
    is_key: true,
    aliases: ["auth.registration_completed", "registration_completed", "register_completed"],
  },
  {
    event_name: "profile.completed",
    family: "profile",
    display_ru: "Профиль заполнен",
    metric_tags: ["activation", "funnel_profile"],
    is_key: true,
    aliases: ["profile.completed", "profile_completed", "profile_done"],
  },
  {
    event_name: "feed.post_published_daily_duo",
    family: "feed",
    display_ru: "Пост Daily Duo",
    metric_tags: ["content", "posts"],
    is_key: true,
    aliases: ["feed.post_published_daily_duo", "post_published_daily_duo", "daily_duo_published", "daily_duo_posted"],
  },
  {
    event_name: "feed.post_published_video",
    family: "feed",
    display_ru: "Видео пост",
    metric_tags: ["content", "posts"],
    is_key: true,
    aliases: ["feed.post_published_video", "post_published_video", "video_post_published", "reel_published"],
  },
  {
    event_name: "events.viewed",
    family: "events",
    display_ru: "Просмотр события",
    metric_tags: ["events"],
    is_key: true,
    aliases: ["events.viewed", "event_viewed", "events_viewed", "event_opened"],
  },
  {
    event_name: "events.joined",
    family: "events",
    display_ru: "Вступление в событие",
    metric_tags: ["events", "funnel_events"],
    is_key: true,
    aliases: ["events.joined", "event_joined", "event_member_added", "first_event_join", "event_join"],
  },
  {
    event_name: "chat.connect_sent",
    family: "social",
    display_ru: "Connect отправлен",
    metric_tags: ["social", "funnel_social"],
    is_key: true,
    aliases: ["chat.connect_sent", "connect_sent", "connect_clicked", "connect_request_sent"],
  },
  {
    event_name: "chat.connect_replied",
    family: "social",
    display_ru: "Ответ на connect",
    metric_tags: ["social", "funnel_social"],
    is_key: true,
    aliases: ["chat.connect_replied", "connect_replied", "first_message_sent", "connect_reply"],
  },
  {
    event_name: "chat.message_sent",
    family: "social",
    display_ru: "Сообщение в чате",
    metric_tags: ["social", "engagement", "wmc"],
    is_key: true,
    aliases: ["chat.message_sent", "message_sent", "chat_message_sent", "chat_sent"],
  },
  {
    event_name: "comment.created",
    family: "feed",
    display_ru: "Комментарий создан",
    metric_tags: ["engagement", "comments"],
    is_key: true,
    aliases: ["comment.created", "comment_created", "comment_sent"],
  },
  {
    event_name: "safety.report_created",
    family: "safety",
    display_ru: "Жалоба создана",
    metric_tags: ["safety"],
    is_key: true,
    aliases: ["safety.report_created", "report_created", "report_submitted"],
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

const LEGACY_CANONICAL_BY_NEW: Record<string, string> = {
  "auth.register_started": "register_started",
  "auth.telegram_verified": "telegram_verified",
  "auth.registration_completed": "registration_completed",
  "profile.completed": "profile_completed",
  "feed.post_published_daily_duo": "post_published_daily_duo",
  "feed.post_published_video": "post_published_video",
  "events.viewed": "event_viewed",
  "events.joined": "event_joined",
  "chat.connect_sent": "connect_sent",
  "chat.connect_replied": "connect_replied",
  "chat.message_sent": "message_sent",
  "comment.created": "comment_created",
  "safety.report_created": "report_created",
};

const aliasToCanonical = new Map<string, string>();
for (const item of EVENT_DICTIONARY) {
  for (const alias of item.aliases) aliasToCanonical.set(alias, item.event_name);
}

export function canonicalizeEventName(eventName: string | null | undefined) {
  if (!eventName) return "unknown";
  const canonical = aliasToCanonical.get(eventName) ?? eventName;
  return LEGACY_CANONICAL_BY_NEW[canonical] ?? canonical;
}

export function aliasesForCanonical(canonical: string) {
  const resolvedCanonical = aliasToCanonical.get(canonical) ?? canonical;
  const item = EVENT_DICTIONARY.find((x) => x.event_name === resolvedCanonical || LEGACY_CANONICAL_BY_NEW[x.event_name] === canonical);
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
  dau: [
    "app.session_start",
    "event_viewed",
    "event_joined",
    "post_published_daily_duo",
    "post_published_video",
    "connect_sent",
    "connect_replied",
    "message_sent",
    "comment_created",
  ],
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
