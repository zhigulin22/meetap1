export type MetricDictionaryItem = {
  key: string;
  name_ru: string;
  abbr: string;
  definition: string;
  why_it_matters: string;
  healthy_range: string;
  levers: string;
  event_names_used: string[];
};

export const METRIC_DICTIONARY: Record<string, MetricDictionaryItem> = {
  dau_proxy: {
    key: "dau_proxy",
    name_ru: "Дневная активная аудитория",
    abbr: "DAU",
    definition: "Уникальные user_id с событиями активности за сутки.",
    why_it_matters: "Показывает ежедневную полезность продукта.",
    healthy_range: "Стабильный рост/флэт без резких провалов.",
    levers: "Контент, quality connect, event join UX, пуши/ре-энгейджмент.",
    event_names_used: ["app.session_start", "events.viewed", "events.joined", "chat.message_sent", "feed.post_published_daily_duo", "feed.post_published_video"],
  },
  wau_proxy: {
    key: "wau_proxy",
    name_ru: "Недельная активная аудитория",
    abbr: "WAU",
    definition: "Уникальные user_id с событиями активности за 7 дней.",
    why_it_matters: "Показывает удержание недельного цикла.",
    healthy_range: "WAU растет вместе с DAU, без деградации доли возвращений.",
    levers: "Серии ивентов, ремайндеры, onboarding 2-го действия.",
    event_names_used: ["events.viewed", "events.joined", "chat.connect_sent", "chat.message_sent"],
  },
  tg_verify_rate: {
    key: "tg_verify_rate",
    name_ru: "Доля Telegram-верификации",
    abbr: "TG Verify Rate",
    definition: "auth.telegram_verified / auth.register_started.",
    why_it_matters: "Ключевой шаг входа в продукт.",
    healthy_range: "Держать без резких дневных провалов.",
    levers: "Webhook, ботовый UX, таймауты, fallback.",
    event_names_used: ["auth.register_started", "register_started", "auth.telegram_verified", "telegram_verified"],
  },
  registration_completion_rate: {
    key: "registration_completion_rate",
    name_ru: "Завершение регистрации",
    abbr: "Reg Completion",
    definition: "auth.registration_completed / auth.register_started.",
    why_it_matters: "Главная верхняя конверсия growth-воронки.",
    healthy_range: "Не ниже базового уровня последнего месяца.",
    levers: "Простота шагов, скорость API, понятные ошибки.",
    event_names_used: ["auth.register_started", "register_started", "auth.registration_completed", "registration_completed"],
  },
  posts_duo_30d: {
    key: "posts_duo_30d",
    name_ru: "Публикации Daily Duo",
    abbr: "Duo Posts",
    definition: "Количество post_published_daily_duo за период.",
    why_it_matters: "Ядро контентной привычки.",
    healthy_range: "Рост вместе с active users.",
    levers: "Удобный create flow, reminders, quality feed.",
    event_names_used: ["post_published_daily_duo", "feed.post_published_daily_duo"],
  },
  posts_video_30d: {
    key: "posts_video_30d",
    name_ru: "Публикации видео",
    abbr: "Video Posts",
    definition: "Количество post_published_video за период.",
    why_it_matters: "Влияет на consumption и вовлеченность.",
    healthy_range: "Стабильная доля среди всех постов.",
    levers: "Съемка/аплоад UX, качество рекомендаций.",
    event_names_used: ["post_published_video", "feed.post_published_video"],
  },
  event_joined_30d: {
    key: "event_joined_30d",
    name_ru: "Вступления в события",
    abbr: "Event Joins",
    definition: "Количество event_joined за период.",
    why_it_matters: "Главный сигнал оффлайн-ценности.",
    healthy_range: "join_rate растет при стабильных views.",
    levers: "Карточка ивента, value proposition, reminders.",
    event_names_used: ["event_joined", "events.joined"],
  },
  reply_rate: {
    key: "reply_rate",
    name_ru: "Доля ответов на коннект",
    abbr: "Reply Rate",
    definition: "connect_replied / connect_sent.",
    why_it_matters: "Ключевой social KPI качества мэтчинга.",
    healthy_range: "Без резкого падения при росте connect_sent.",
    levers: "Антиспам лимиты, профили, AI icebreaker, ranking.",
    event_names_used: ["connect_sent", "chat.connect_sent", "connect_replied", "chat.connect_replied"],
  },
  connect_sent_30d: {
    key: "connect_sent_30d",
    name_ru: "Отправленные коннекты",
    abbr: "Connect Sent",
    definition: "Количество connect_sent за период.",
    why_it_matters: "Показывает объем social intent.",
    healthy_range: "Рост без деградации reply_rate.",
    levers: "Ранжирование, лимиты, качество рекомендаций.",
    event_names_used: ["connect_sent", "chat.connect_sent"],
  },
  connect_replied_30d: {
    key: "connect_replied_30d",
    name_ru: "Ответы на коннекты",
    abbr: "Connect Replied",
    definition: "Количество connect_replied за период.",
    why_it_matters: "Сигнал meaningful social outcomes.",
    healthy_range: "Растет пропорционально connect_sent.",
    levers: "Интро, антиспам, relevance matching.",
    event_names_used: ["connect_replied", "chat.connect_replied"],
  },
  reports_count_24h: {
    key: "reports_count_24h",
    name_ru: "Жалобы за сутки",
    abbr: "Reports 24h",
    definition: "Количество report_created за 24ч.",
    why_it_matters: "Индикатор safety и токсичности.",
    healthy_range: "Без spike относительно 7-дневной базы.",
    levers: "Модерация, лимиты, risk actions.",
    event_names_used: ["report_created", "safety.report_created"],
  },
  ai_cost_total_24h: {
    key: "ai_cost_total_24h",
    name_ru: "Стоимость AI за сутки",
    abbr: "AI Cost 24h",
    definition: "Сумма properties.usd для ai_cost за 24ч.",
    why_it_matters: "Контроль unit economics.",
    healthy_range: "Рост cost оправдан ростом ключевых KPI.",
    levers: "Rate limits, retries, routing, caching.",
    event_names_used: ["ai_cost", "ai_request_cost"],
  },
};

export function metricMeta(key: string): MetricDictionaryItem | null {
  return METRIC_DICTIONARY[key] ?? null;
}

export function metricHelpItem(key: string) {
  const meta = metricMeta(key);
  if (!meta) return null;
  return {
    title: `${meta.name_ru} (${meta.abbr})`,
    body: meta.definition,
    why: meta.why_it_matters,
    influence: meta.levers,
    normal: meta.healthy_range,
    next: "Открой Drilldown для таблиц по дням/неделям/месяцам.",
  };
}
