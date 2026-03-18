import { supabaseAdmin } from "@/supabase/admin";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type BadgeCategory =
  | "Социальные связи"
  | "Мероприятия"
  | "Контент"
  | "Стабильность"
  | "Комьюнити"
  | "Сезонные миссии";

export type BadgeRule = {
  metric: string;
  target: number;
  cooldown_days: number;
  window_days: number;
  value_label: string;
  why: string;
  system_version: number;
};

export type BadgeCatalogRow = {
  key: string;
  title: string;
  description: string;
  category: BadgeCategory;
  icon: string;
  rarity: BadgeRarity;
  tier: number;
  rules: BadgeRule;
  is_active: boolean;
  is_seasonal: boolean;
  season_key: string | null;
};

type TrackConfig = {
  category: BadgeCategory;
  baseKey: string;
  baseTitle: string;
  icon: string;
  metric: string;
  valueLabel: string;
  why: string;
  targets: [number, number, number, number];
  seasonal?: boolean;
  seasonKey?: string;
};

const TIER_LABELS = ["I", "II", "III", "IV"];
const RARITY_BY_TIER: Record<number, BadgeRarity> = {
  1: "common",
  2: "rare",
  3: "epic",
  4: "legendary",
};

const COOLDOWN_BY_TIER: Record<number, number> = {
  1: 14,
  2: 30,
  3: 60,
  4: 120,
};

const TRACKS: TrackConfig[] = [
  { category: "Социальные связи", baseKey: "social_reply_chain", baseTitle: "Контакт не на один день", icon: "Handshake", metric: "connect_replied_total", valueLabel: "ответов", why: "Отражает качество первых знакомств", targets: [10, 30, 80, 150] },
  { category: "Социальные связи", baseKey: "social_first_move", baseTitle: "Первый шаг", icon: "Send", metric: "connect_sent_total", valueLabel: "инициированных коннектов", why: "Показывает системную активность в знакомствах", targets: [25, 80, 220, 500] },
  { category: "Социальные связи", baseKey: "social_dialog_depth", baseTitle: "Глубина диалога", icon: "MessageCircle", metric: "message_sent_total", valueLabel: "сообщений", why: "Показывает вовлечение в длительное общение", targets: [60, 180, 520, 1300] },
  { category: "Социальные связи", baseKey: "social_trusted_circle", baseTitle: "Рекомендован после встреч", icon: "ShieldCheck", metric: "endorsements_unique_senders", valueLabel: "уникальных отметок", why: "Отражает доверие от разных людей", targets: [5, 15, 40, 100] },

  { category: "Мероприятия", baseKey: "events_pathfinder", baseTitle: "Человек встреч", icon: "CalendarCheck", metric: "event_joined_total", valueLabel: "посещений", why: "Отражает офлайн вовлеченность", targets: [5, 15, 30, 60] },
  { category: "Мероприятия", baseKey: "events_city_explorer", baseTitle: "География встреч", icon: "Compass", metric: "event_unique_cities", valueLabel: "городов", why: "Показывает разнообразие офлайн опыта", targets: [2, 4, 7, 12] },
  { category: "Мероприятия", baseKey: "events_discovery", baseTitle: "Охотник за событиями", icon: "MapPin", metric: "event_viewed_total", valueLabel: "просмотров мероприятий", why: "Отражает активный поиск событий", targets: [30, 120, 320, 900] },
  { category: "Мероприятия", baseKey: "events_consistency", baseTitle: "Ритм мероприятий", icon: "Milestone", metric: "event_weeks_active", valueLabel: "активных недель", why: "Подтверждает стабильное участие в ивентах", targets: [4, 12, 24, 48] },

  { category: "Контент", baseKey: "content_storyline", baseTitle: "Личная хроника", icon: "Image", metric: "posts_total", valueLabel: "публикаций", why: "Формирует устойчивый публичный профиль", targets: [10, 30, 80, 180] },
  { category: "Контент", baseKey: "content_duo_signature", baseTitle: "Фирменный Daily Duo", icon: "Camera", metric: "duo_posts_total", valueLabel: "duo-постов", why: "Подчеркивает уникальный формат продукта", targets: [5, 20, 50, 120] },
  { category: "Контент", baseKey: "content_video_voice", baseTitle: "Голос в видео", icon: "Video", metric: "video_posts_total", valueLabel: "видео", why: "Показывает уверенное самовыражение", targets: [5, 20, 60, 140] },
  { category: "Контент", baseKey: "content_comment_care", baseTitle: "Диалог в комментариях", icon: "PenSquare", metric: "comments_created_total", valueLabel: "комментариев", why: "Показывает участие в обсуждениях", targets: [20, 80, 250, 700] },

  { category: "Стабильность", baseKey: "stability_weekly_rhythm", baseTitle: "Надежный ритм", icon: "Flame", metric: "active_weeks_total", valueLabel: "активных недель", why: "Главный индикатор долгосрочной устойчивости", targets: [8, 16, 32, 48] },
  { category: "Стабильность", baseKey: "stability_monthly_path", baseTitle: "Долгая дистанция", icon: "Clock3", metric: "active_months_total", valueLabel: "активных месяцев", why: "Показывает многомесячную стабильность", targets: [2, 4, 8, 18] },
  { category: "Стабильность", baseKey: "stability_returning", baseTitle: "Возвращаюсь регулярно", icon: "Monitor", metric: "sessions_total", valueLabel: "сессий", why: "Фиксирует устойчивую привычку использования", targets: [30, 120, 320, 780] },
  { category: "Стабильность", baseKey: "stability_profile_care", baseTitle: "Профиль под контролем", icon: "Sparkles", metric: "profile_updates_total", valueLabel: "обновлений профиля", why: "Показывает бережное отношение к профилю", targets: [2, 6, 12, 24] },

  { category: "Комьюнити", baseKey: "community_recognized", baseTitle: "Теплый человек", icon: "Trophy", metric: "endorsements_received_total", valueLabel: "полученных отметок", why: "Показывает пользу для сообщества", targets: [10, 30, 80, 180] },
  { category: "Комьюнити", baseKey: "community_resonance", baseTitle: "Социальный резонанс", icon: "Gem", metric: "community_score", valueLabel: "баллов вклада", why: "Композитный показатель вклада в экосистему", targets: [120, 320, 900, 2200] },
  { category: "Комьюнити", baseKey: "community_dialog_days", baseTitle: "Дни с живым общением", icon: "Sun", metric: "message_days_total", valueLabel: "дней с сообщениями", why: "Показывает устойчивый живой контакт", targets: [10, 30, 90, 180] },
  { category: "Комьюнити", baseKey: "community_cross_over", baseTitle: "Связующее звено", icon: "Globe2", metric: "mixed_actions_total", valueLabel: "комбинированных действий", why: "Показывает баланс контента, событий и общения", targets: [80, 220, 700, 1700] },

  { category: "Сезонные миссии", baseKey: "season_connections", baseTitle: "Сезон: социальный импульс", icon: "Zap", metric: "connect_replied_total", valueLabel: "ответов", why: "Долгая миссия по развитию социальных связей", targets: [25, 60, 120, 240], seasonal: true, seasonKey: "long-cycle" },
  { category: "Сезонные миссии", baseKey: "season_events", baseTitle: "Сезон: маршрут событий", icon: "Snowflake", metric: "event_joined_total", valueLabel: "посещений", why: "Долгая миссия по офлайн активности", targets: [12, 24, 40, 70], seasonal: true, seasonKey: "long-cycle" },
  { category: "Сезонные миссии", baseKey: "season_content", baseTitle: "Сезон: медиа-путь", icon: "Rocket", metric: "posts_total", valueLabel: "публикаций", why: "Долгая миссия по созданию контента", targets: [20, 50, 120, 260], seasonal: true, seasonKey: "long-cycle" },
  { category: "Сезонные миссии", baseKey: "season_stability", baseTitle: "Сезон: устойчивость", icon: "Leaf", metric: "active_weeks_total", valueLabel: "активных недель", why: "Долгая миссия на дисциплину и регулярность", targets: [12, 24, 36, 52], seasonal: true, seasonKey: "long-cycle" },
];

function makeTrackRows(track: TrackConfig): BadgeCatalogRow[] {
  return track.targets.map((target, idx) => {
    const tier = idx + 1;
    return {
      key: `${track.baseKey}_t${tier}`,
      title: `${track.baseTitle} ${TIER_LABELS[idx]}`,
      description: `${track.why}. Требование: ${target} ${track.valueLabel}.`,
      category: track.category,
      icon: track.icon,
      rarity: RARITY_BY_TIER[tier],
      tier,
      rules: {
        metric: track.metric,
        target,
        cooldown_days: COOLDOWN_BY_TIER[tier],
        window_days: 3650,
        value_label: track.valueLabel,
        why: track.why,
        system_version: 2,
      },
      is_active: true,
      is_seasonal: Boolean(track.seasonal),
      season_key: track.seasonKey ?? null,
    };
  });
}

export function buildBadgeCatalog() {
  return TRACKS.flatMap(makeTrackRows);
}

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return message.includes("column") && message.includes(column.toLowerCase()) && message.includes("does not exist");
}

let lastCatalogEnsureAt = 0;
const CATALOG_ENSURE_MS = 10 * 60 * 1000;

export async function ensureBadgeCatalog() {
  if (Date.now() - lastCatalogEnsureAt < CATALOG_ENSURE_MS) return;

  const catalog = buildBadgeCatalog();
  const payloadWithExtendedColumns = catalog.map((row) => ({
    key: row.key,
    title: row.title,
    description: row.description,
    category: row.category,
    icon: row.icon,
    rules: row.rules,
    is_active: row.is_active,
    is_seasonal: row.is_seasonal,
    season_key: row.season_key,
    rarity: row.rarity,
    tier: row.tier,
  }));

  const upsertExtended = await supabaseAdmin.from("badges").upsert(payloadWithExtendedColumns, { onConflict: "key" });
  if (upsertExtended.error) {
    if (isMissingColumnError(upsertExtended.error, "rarity") || isMissingColumnError(upsertExtended.error, "tier")) {
      const fallbackPayload = catalog.map((row) => ({
        key: row.key,
        title: row.title,
        description: row.description,
        category: row.category,
        icon: row.icon,
        rules: row.rules,
        is_active: row.is_active,
        is_seasonal: row.is_seasonal,
        season_key: row.season_key,
      }));
      const upsertFallback = await supabaseAdmin.from("badges").upsert(fallbackPayload, { onConflict: "key" });
      if (upsertFallback.error) {
        throw new Error(upsertFallback.error.message);
      }
    } else {
      throw new Error(upsertExtended.error.message);
    }
  }

  lastCatalogEnsureAt = Date.now();
}
