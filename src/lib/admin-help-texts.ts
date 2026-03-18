import { metricHelpItem, metricMeta } from "@/lib/metric-dictionary";

export type HelpItem = {
  title: string;
  body: string;
  why: string;
  influence: string;
  normal: string;
  next: string;
};

export type HelpTexts = Record<string, HelpItem>;

export const DEFAULT_HELP_TEXTS: HelpTexts = {
  "section.guide": {
    title: "Как пользоваться админкой",
    body: "Этот раздел показывает пошаговый сценарий проверки продукта за 5 минут.",
    why: "Нужен, чтобы новый сотрудник быстро понял, куда смотреть при проблемах.",
    influence: "Пройдите чеклист сверху вниз: health -> stream -> metrics -> users -> risk.",
    normal: "После запуска трафика в Events Stream должны идти события, а KPI перестают быть нулевыми.",
    next: "Открой Operations Center и проверь статус Data pipeline.",
  },
  "section.operations": {
    title: "Operations Center",
    body: "Центр текущего состояния системы: пайплайн событий, интеграции, AI и риски.",
    why: "Помогает быстро понять, проблема в продукте, интеграции или в данных.",
    influence: "Используйте Active Alerts и Quick Actions для быстрой стабилизации.",
    normal: "Events last 5m > 0, AI error rate низкий, reports 1h без всплесков.",
    next: "При аномалии открой Events Stream и затем Data Quality.",
  },
  "section.support": {
    title: "Support Desk",
    body: "Рабочее место саппорта: поиск пользователя, внутренние заметки и тикеты.",
    why: "Снижает время ответа и фиксирует контекст по сложным кейсам.",
    influence: "Ведите internal notes и эскалируйте тикеты модератору при рисках.",
    normal: "Каждый тикет имеет статус и ответственного; нет заметок с PII в открытом виде.",
    next: "Для нарушений переходите в Risk/Reports.",
  },
  "section.config": {
    title: "Config Center",
    body: "Управление фичами и лимитами без релиза.",
    why: "Позволяет оперативно снижать риски и тестировать изменения.",
    influence: "Изменяйте лимиты осторожно и сразу смотрите эффект в метриках 24h.",
    normal: "Лимиты в safe range, флаги с понятным rollout и owner.",
    next: "После изменения проверьте Social/Safety KPI и Audit log.",
  },
  "section.data_quality": {
    title: "Data Quality",
    body: "Проверка, что события приходят корректно и маппинг событий полный.",
    why: "Без этого метрики и воронки становятся ложными.",
    influence: "Добавляйте unknown events в словарь и исправляйте naming mismatch.",
    normal: "Unknown events близко к нулю, events_last_24h стабильный.",
    next: "Нажмите Add to dictionary для новых event_name.",
  },
  "section.security": {
    title: "Security Center",
    body: "Базовый статус защиты: лимиты, runbook, контроль доступа.",
    why: "Позволяет реагировать на abuse/спам/инциденты по единому процессу.",
    influence: "При spike reports включайте safe mode и повышайте throttling.",
    normal: "Rate limiting включён, секреты server-only, PII маскируется.",
    next: "При инциденте фиксируйте действия в Admin Audit Log.",
  },
  "metric.dau_proxy": {
    title: "Дневная аудитория (DAU)",
    body: "Уникальные пользователи с активностью за 24 часа.",
    why: "Базовая метрика жизнеспособности продукта.",
    influence: "Увеличивается от стабильного контента, событий и ответов в чатах.",
    normal: "Главное не абсолют, а тренд и отсутствие резких провалов.",
    next: "Нажмите карточку и проверьте breakdown по дням/группам.",
  },
  "metric.tg_verify_rate": {
    title: "Telegram verify rate",
    body: "Доля верификаций от начатых регистраций.",
    why: "Показывает здоровье входа в продукт.",
    influence: "Зависит от webhook бота, UX шага верификации и таймаутов.",
    normal: "Резкое падение — сигнал проверить Integrations и Auth health.",
    next: "Откройте drilldown и Events Stream по auth.telegram_verified.",
  },
  "metric.registration_completion_rate": {
    title: "Registration completion rate",
    body: "Доля завершённых регистраций от начатых.",
    why: "Ключевая конверсия активации новых пользователей.",
    influence: "Зависит от понятности шага регистрации и ошибок API.",
    normal: "Падение при стабильном трафике — признак UX или интеграционной проблемы.",
    next: "Проверьте воронку Funnels и события auth.*.",
  },
  "metric.reply_rate": {
    title: "Reply rate",
    body: "Доля ответов на отправленные connect.",
    why: "Прямой сигнал качества знакомств и matchmaking.",
    influence: "Растёт при качественном профиле, релевантных интро и anti-spam лимитах.",
    normal: "Снижение при росте connect_sent часто означает спам-поведение.",
    next: "Откройте drilldown и проверьте top users + Risk Center.",
  },
  "metric.reports_count_24h": {
    title: "Жалобы за 24ч",
    body: "Количество report_created за последние сутки.",
    why: "Индикатор safety-напряжения в продукте.",
    influence: "Снижается от throttling, модерации и ограничения токсичных аккаунтов.",
    normal: "Важен скачок относительно своей базы, а не абсолютное число.",
    next: "Переходите в Reports и Risk, применяйте действия по очереди.",
  },
  "metric.ai_cost_total_24h": {
    title: "AI cost за 24ч",
    body: "Суммарная стоимость AI-вызовов за сутки.",
    why: "Позволяет контролировать юнит-экономику и риски перерасхода.",
    influence: "Меняется от количества запросов, ретраев и лимитов на endpoints.",
    normal: "Рост без роста ключевых KPI — сигнал оптимизировать usage.",
    next: "Откройте AI tab и сравните cost с бизнес-метриками.",
  },
};

export const KPI_SOURCE_MAP: Record<string, "events" | "users" | "mixed"> = {
  users_total: "users",
  users_new_24h: "users",
  users_new_7d: "users",
  users_new_30d: "users",
  profile_completed_rate: "users",
  facts_filled_rate: "users",
  avatar_rate: "users",
  psychotest_completed_rate: "users",
  avg_interests_count: "users",
  tg_verify_rate: "events",
  registration_completion_rate: "events",
  activation_rate: "events",
  reports_count_24h: "events",
  reports_count_7d: "events",
  reports_count_30d: "events",
  ai_cost_total_24h: "events",
  ai_cost_total_7d: "events",
  ai_cost_total_30d: "events",
};

export function kpiSource(key: string): "events" | "users" | "mixed" {
  if (KPI_SOURCE_MAP[key]) return KPI_SOURCE_MAP[key];
  if (key.includes("users") || key.includes("profile") || key.includes("avatar") || key.includes("facts")) return "users";
  if (key.includes("rate") && (key.includes("reply") || key.includes("verify") || key.includes("registration"))) return "events";
  return "events";
}

export function getMetricHelp(key: string): HelpItem | null {
  return (DEFAULT_HELP_TEXTS[("metric." + key) as keyof typeof DEFAULT_HELP_TEXTS] ?? metricHelpItem(key)) as HelpItem | null;
}

export function getMetricLabel(key: string) {
  const meta = metricMeta(key);
  return meta ? (meta.name_ru + " (" + meta.abbr + ")") : key;
}

export function getMetricMeta(key: string) {
  return metricMeta(key);
}
