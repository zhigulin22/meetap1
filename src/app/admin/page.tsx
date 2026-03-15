"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  Square,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { AdminShell, type AdminSection, type AdminSegment } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminApi } from "@/lib/admin-client";
import {
  adminHealthResponseSchema,
  liveEventsResponseSchema,
  metricsSummaryResponseSchema,
  userSearchResponseSchema,
} from "@/lib/admin-schemas";
import { api, ApiClientError } from "@/lib/api-client";
import { HelpTip } from "@/components/help-tip";
import { AdminEmptyState } from "@/components/admin-empty-state";
import { KpiDrilldownDrawer } from "@/components/kpi-drilldown-drawer";
import { DEFAULT_HELP_TEXTS, getMetricHelp, getMetricLabel, kpiSource } from "@/lib/admin-help-texts";
import { roleHasPermission } from "@/lib/admin-rbac";

const TAB_LABELS: Record<string, string> = {
  growth: "Рост",
  activation: "Активация",
  engagement: "Вовлеченность",
  content: "Контент",
  events: "События",
  social: "Знакомства",
  safety: "Безопасность",
  ai: "AI и стоимость",
  health: "Стабильность",
};

const KPI_GROUPS: Record<string, string[]> = {
  growth: ["users_total", "users_new_24h", "users_new_7d", "users_new_30d", "registration_completion_rate", "tg_verify_rate", "activation_rate", "profile_completed_rate"],
  activation: ["profile_completed_rate", "facts_filled_rate", "avatar_rate", "psychotest_completed_rate", "avg_interests_count"],
  engagement: ["events_total_24h", "events_total_7d", "events_total_30d", "active_users_24h", "active_users_7d", "active_users_30d", "sessions_24h", "dau_proxy", "wau_proxy"],
  content: ["posts_duo_24h", "posts_duo_7d", "posts_duo_30d", "posts_video_24h", "posts_video_7d", "posts_video_30d", "comments_24h", "comments_7d", "comments_30d", "posters_7d"],
  events: ["event_viewed_24h", "event_viewed_7d", "event_viewed_30d", "event_joined_24h", "event_joined_7d", "event_joined_30d", "join_rate"],
  social: ["connect_sent_24h", "connect_sent_7d", "connect_sent_30d", "connect_replied_24h", "connect_replied_7d", "connect_replied_30d", "reply_rate", "messages_sent_24h", "messages_sent_7d", "messages_sent_30d", "continued_chats_proxy_30d"],
  safety: ["shadow_banned_count", "message_limited_count", "reports_count_24h", "reports_count_7d", "reports_count_30d", "risk_users_count", "deleted_users_30d"],
  ai: ["ai_cost_total_24h", "ai_cost_total_7d", "ai_cost_total_30d", "ai_calls_24h", "ai_error_rate"],
  health: ["events_total_24h", "events_total_7d", "events_total_30d", "active_users_24h", "users_total"],
};

const ADMIN_SUMMARY_SNAPSHOT_KEY = "admin_metrics_summary_snapshot_v2";

type SectionGuide = {
  title: string;
  value: string;
  how: string;
  firstSteps: string[];
  scenarios: string[];
  actions: string[];
  roles: string;
};

const DEFAULT_SECTION_GUIDE: SectionGuide = {
  title: "Как использовать раздел",
  value: "Раздел показывает операционные данные и действия для управления продуктом.",
  how: "Сначала проверь KPI, затем таблицу ниже, после этого применяй action-кнопки справа.",
  firstSteps: ["Оцени KPI", "Проверь таблицу ниже", "Зафиксируй действие в audit"],
  scenarios: ["Если пусто — открой Events Stream", "Если ошибка — запусти Diagnostics"],
  actions: ["Фильтры периода/сегмента", "Кнопки управления в карточках"],
  roles: "support/moderator/analyst/admin/super_admin",
};

const SECTION_GUIDES: Partial<Record<AdminSection, SectionGuide>> = {
  overview: {
    title: "Обзор",
    value: "Быстрый срез состояния продукта: основные KPI, топ-события, воронка.",
    how: "Кликни на KPI для детализации в отдельном окне и перехода в Events Stream.",
    firstSteps: ["Проверь DAU/WAU/MAU", "Открой top_events_24h", "Проверь funnel"],
    scenarios: ["0 событий за 24ч — проверь tracking", "Падает verify rate — открой Operations"],
    actions: ["Открыть Drilldown", "Создать Alert", "Перейти в Events Stream"],
    roles: "analyst/admin/super_admin",
  },
  operations: {
    title: "Operations Center",
    value: "Показывает состояние pipeline, алертов и инцидентов в реальном времени.",
    how: "Иди сверху вниз: health strip -> alerts -> incident timeline -> quick actions.",
    firstSteps: ["Проверь status strip", "Разбери open alerts", "Поставь owner"],
    scenarios: ["Spike reports", "AI timeout", "TG verify degradation"],
    actions: ["Ack/Resolve alert", "Disable flag", "Export snapshot"],
    roles: "moderator/admin/super_admin",
  },
  metrics_lab: {
    title: "Metrics Lab",
    value: "Детальные продуктовые метрики по направлениям: рост, контент, safety, AI.",
    how: "Выбери вкладку, нажми KPI, посмотри breakdown по дням/неделям/месяцам.",
    firstSteps: ["Выбери вкладку", "Кликни KPI", "Сверь с previous period"],
    scenarios: ["No data — проверить event mapping", "Low status — смотреть top users/events"],
    actions: ["Drilldown", "Create alert", "Create experiment"],
    roles: "analyst/admin/super_admin",
  },
  events_live: {
    title: "События (Live)",
    value: "Живая лента событий из analytics_events для проверки трекинга.",
    how: "Фильтруй по event_name/user_id и сверяй, что события доходят в систему.",
    firstSteps: ["Поставь фильтр event_name", "Сверь время события", "Проверь свойства"],
    scenarios: ["Нет событий — проблема трекинга", "Mismatch event_name — авто-маппинг"],
    actions: ["Copy JSON", "Write test event", "Переход в Data Quality"],
    roles: "support/moderator/analyst/admin/super_admin",
  },
  users: {
    title: "Users 360",
    value: "Профиль пользователя, активность, риск-сигналы и действия модерации.",
    how: "Найди пользователя -> открой карточку -> проверь timeline -> применяй действие.",
    firstSteps: ["Поиск пользователя", "Проверка risk/status chips", "Открыть User 360"],
    scenarios: ["Спамер по connect", "Низкий reply rate", "Много жалоб"],
    actions: ["Limit messaging", "Shadowban", "Block/Unblock"],
    roles: "support(read)/moderator/manage/admin/super_admin",
  },
  support: {
    title: "Support Desk",
    value: "Интерфейс саппорта: поиск, заметки, тикеты и эскалация кейсов.",
    how: "Ищи пользователя, фиксируй note, меняй статус тикета и при риске эскалируй.",
    firstSteps: ["Найди user", "Добавь internal note", "Поставь ticket status"],
    scenarios: ["Эскалация в moderation", "Повторный инцидент"],
    actions: ["Assign", "Resolve", "Escalate"],
    roles: "support/moderator/admin/super_admin",
  },
  risk: {
    title: "Risk Center",
    value: "Очередь подозрительных аккаунтов и объяснение причин риска.",
    how: "Сортируй по score, проверяй сигналы и применяй bulk/single actions.",
    firstSteps: ["Проверь high-risk queue", "Оцени top signals", "Открой User 360"],
    scenarios: ["Burst connect_sent", "Reports spike", "Repeated message"],
    actions: ["Bulk limit", "Bulk shadowban", "Mark safe"],
    roles: "moderator/admin/super_admin",
  },
  reports: {
    title: "Жалобы",
    value: "Очередь пользовательских жалоб с контекстом и статусом обработки.",
    how: "Открывай кейс, принимай решение, меняй статус и записывай причину.",
    firstSteps: ["Отфильтруй open", "Проверь контекст", "Выбери решение"],
    scenarios: ["False positive", "Повторный нарушитель"],
    actions: ["In review", "Resolve", "Escalate"],
    roles: "moderator/admin/super_admin",
  },
  config: {
    title: "Config Center",
    value: "Управление фичами и лимитами без релиза.",
    how: "Изменяй параметр в safe range, проверяй эффект в KPI и audit log.",
    firstSteps: ["Проверь текущее значение", "Измени в safe range", "Проверь KPI"],
    scenarios: ["Reply rate падает", "Reports растут"],
    actions: ["Toggle flag", "Apply limits", "Rollback"],
    roles: "admin/super_admin",
  },
  data_quality: {
    title: "Data Quality",
    value: "Проверка качества событий и корректности словаря метрик.",
    how: "Смотри unknown events, устраняй mismatch и добавляй mapping при необходимости.",
    firstSteps: ["Проверь top events", "Проверь unknown", "Добавь mapping"],
    scenarios: ["Метрики 0 при наличии событий", "Новый event_name без словаря"],
    actions: ["Add to dictionary", "Run diagnostics"],
    roles: "analyst/admin/super_admin",
  },
  security: {
    title: "Security Center",
    value: "Статус защиты: роли, ограничения, runbook и инциденты.",
    how: "Проверь baseline checklist, затем active threats и план реакции.",
    firstSteps: ["Проверь RBAC", "Проверь rate limits", "Проверь runbook"],
    scenarios: ["DDOS", "TG verify outage", "Reports spike"],
    actions: ["Enable safe mode", "Adjust limits", "Incident note"],
    roles: "admin/super_admin",
  },
};

const REQUIRED_COVERAGE: Array<{ key: string; label: string; aliases: string[] }> = [
  { key: "open_feed", label: "open_feed", aliases: ["open_feed", "app.session_start"] },
  { key: "open_event", label: "open_event", aliases: ["open_event", "events.viewed", "event_viewed"] },
  { key: "join_event", label: "join_event", aliases: ["join_event", "events.joined", "event_joined"] },
  { key: "connect_sent", label: "connect_sent", aliases: ["connect_sent", "chat.connect_sent"] },
  { key: "connect_replied", label: "connect_replied", aliases: ["connect_replied", "chat.connect_replied"] },
  { key: "message_sent", label: "message_sent", aliases: ["message_sent", "chat.message_sent", "chat_message_sent"] },
  { key: "comment_created", label: "comment_created", aliases: ["comment_created", "comment.created"] },
  { key: "profile_updated", label: "profile_updated", aliases: ["profile_updated", "profile_completed", "profile.completed"] },
  { key: "psychotest_completed", label: "psychotest_completed", aliases: ["psychotest_completed", "profile.psychotest_completed"] },
];

function formatKpi(key: string, value: number) {
  if (!Number.isFinite(value)) return "N/A";
  if (key.includes("_rate") || key.includes("rate")) return `${(value * 100).toFixed(1)}%`;
  if (key.includes("cost")) return `$${value.toFixed(4)}`;
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("ru-RU");
  if (Number.isInteger(value)) return value.toLocaleString("ru-RU");
  return value.toFixed(3);
}

function parseError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED") {
      return "Недостаточно прав для этого действия. Проверь роль пользователя.";
    }
    if (error.code === "MISSING_ENV") {
      return `Сервер не настроен: ${error.hint ?? "добавь ключи env и redeploy"}.`;
    }
    if (error.code === "TIMEOUT") {
      return "Сервер временно перегружен. Попробуй повторить через 1-2 секунды.";
    }

    const cleaned = error.message
      .replace(/\[[A-Z_]+\]\s*/g, "")
      .replace(/\/api\/[^\s:|]+/g, "API")
      .replace(/https?:\/\/[^\s:|]+/g, "API")
      .replace(/^\s*[^:]+:\s*/, "")
      .trim();

    return cleaned || "Не удалось загрузить данные. Попробуй повторить.";
  }

  if (error instanceof Error) {
    return error.message.replace(/https?:\/\/\S+/g, "API");
  }

  return "Не удалось выполнить запрос";
}

function isTrafficStatusSoftError(error: unknown) {
  if (!(error instanceof ApiClientError)) return false;
  if (error.code === "TIMEOUT") return true;
  const m = error.message.toLowerCase();
  return m.includes("сервер занят") || m.includes("server busy") || m.includes("timeout");
}

function EmptyNote({ text, onOpenStream }: { text: string; onOpenStream?: () => void }) {
  return (
    <AdminEmptyState
      why={text}
      action="Проверь входящий поток событий и фильтры периода/сегмента"
      where="Events Stream / Diagnostics"
      actionLabel={onOpenStream ? "Открыть Events Stream" : undefined}
      onAction={onOpenStream}
    />
  );
}

function deriveDelta(kpis: Record<string, number>, key: string) {
  const current = Number(kpis[key] ?? 0);
  if (!Number.isFinite(current)) return null;

  if (key.endsWith("_24h")) {
    const base = key.replace(/_24h$/, "_7d");
    const weekly = Number(kpis[base] ?? 0);
    if (weekly > current) {
      const prev = (weekly - current) / 6;
      return prev > 0 ? Number(((current - prev) / prev).toFixed(4)) : null;
    }
  }

  if (key.endsWith("_7d")) {
    const base = key.replace(/_7d$/, "_30d");
    const monthly = Number(kpis[base] ?? 0);
    if (monthly > current) {
      const prev = ((monthly - current) / 23) * 7;
      return prev > 0 ? Number(((current - prev) / prev).toFixed(4)) : null;
    }
  }

  return null;
}

function kpiStatus(key: string, value: number): "OK" | "Low" | "No data" {
  if (!Number.isFinite(value)) return "No data";
  if (value === 0) return "No data";
  if (key.includes("rate")) {
    if (value < 0.05) return "Low";
    return "OK";
  }
  if (value < 1) return "Low";
  return "OK";
}

function KpiGrid({
  kpis,
  keys,
  onSelect,
  helpMode,
  helpTexts,
}: {
  kpis: Record<string, number>;
  keys?: string[];
  onSelect?: (metric: string) => void;
  helpMode?: boolean;
  helpTexts?: Record<string, any>;
}) {
  const entries = (keys?.length ? keys.map((k) => [k, kpis[k] ?? 0] as const) : Object.entries(kpis)).filter(([, v]) => typeof v === "number");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([k, v], idx) => {
        const value = Number(v);
        const delta = deriveDelta(kpis, k);
        const source = kpiSource(k);
        const status = kpiStatus(k, value);
        const help = helpTexts?.["metric." + k] ?? getMetricHelp(k) ?? DEFAULT_HELP_TEXTS[("metric." + k) as keyof typeof DEFAULT_HELP_TEXTS] ?? null;

        return (
          <Card
            key={k}
            className={`transition ${onSelect ? "cursor-pointer active:scale-[0.99]" : ""} ${status === "No data" ? "border-warning/30" : ""}`}
            onClick={() => onSelect?.(k)}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className={idx < 5 ? "text-xs font-medium text-[rgb(var(--peach-rgb))]" : "text-xs text-muted"}>{getMetricLabel(k)}</p>
                {helpMode && help ? <HelpTip compact {...help} /> : null}
              </div>

              <p className="text-xl font-semibold text-text">{formatKpi(k, value)}</p>

              <div className="flex flex-wrap gap-1 text-[11px]">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-muted">Источник: {source}</span>
                <span className={`rounded-full border px-2 py-0.5 ${status === "OK" ? "border-emerald-500/40 text-emerald-300" : status === "Low" ? "border-warning/40 text-warning" : "border-danger/40 text-danger"}`}>{status}</span>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-muted">Δ {delta === null ? "n/a" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


function SectionGuideCard({
  section,
  helpMode,
  onOpenGuide,
}: {
  section: AdminSection;
  helpMode: boolean;
  onOpenGuide: () => void;
}) {
  const guide = SECTION_GUIDES[section] ?? DEFAULT_SECTION_GUIDE;
  const sectionHelp = DEFAULT_HELP_TEXTS[`section.${section}` as keyof typeof DEFAULT_HELP_TEXTS];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="inline-flex items-center gap-2">
          {guide.title}
          {helpMode && sectionHelp ? <HelpTip compact {...sectionHelp} /> : null}
        </CardTitle>
        <Button variant="secondary" size="sm" onClick={onOpenGuide}>Как пользоваться</Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted">
        <p><strong className="text-text">Что дает:</strong> {guide.value}</p>
        <p><strong className="text-text">Как пользоваться:</strong> {guide.how}</p>
      </CardContent>
    </Card>
  );
}

function SectionGuideSheet({
  section,
  role,
  open,
  onOpenChange,
}: {
  section: AdminSection;
  role: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const guide = SECTION_GUIDES[section] ?? DEFAULT_SECTION_GUIDE;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader>
        <SheetTitle>{guide.title}: как пользоваться</SheetTitle>
      </SheetHeader>
      <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1 text-sm">
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p><strong>Что это дает:</strong> {guide.value}</p>
          <p className="mt-1"><strong>Как использовать:</strong> {guide.how}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p className="mb-1 font-medium">Что смотреть первым делом</p>
          {guide.firstSteps.map((x) => <p key={x}>• {x}</p>)}
        </div>
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p className="mb-1 font-medium">Типовые сценарии</p>
          {guide.scenarios.map((x) => <p key={x}>• {x}</p>)}
        </div>
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p className="mb-1 font-medium">Доступные действия</p>
          {guide.actions.map((x) => <p key={x}>• {x}</p>)}
        </div>
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p><strong>Роли с доступом:</strong> {guide.roles}</p>
          <p className="mt-1 text-muted">Текущая роль: {role ?? "—"}</p>
        </div>
      </div>
    </Sheet>
  );
}


export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>("overview");
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [segment, setSegment] = useState<AdminSegment>("all");
  const [search, setSearch] = useState("");
  const [metricsTab, setMetricsTab] = useState<keyof typeof KPI_GROUPS>("growth");

  const [eventsFilter, setEventsFilter] = useState({ eventName: "", userId: "", demoGroup: "" });
  const [userFilter, setUserFilter] = useState({
    q: "",
    demo: "all" as "all" | "demo" | "real" | "traffic",
    role: "all",
    shadow_banned: false,
    message_limited: false,
    profile_completed: false,
    city: "",
  });

  const [trafficForm, setTrafficForm] = useState({ users_count: 40, interval_sec: 8, intensity: "normal" as "low" | "normal" | "high", chaos: true });
  const [trafficAction, setTrafficAction] = useState<null | "start" | "stop" | "tick" | "reset">(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficLastTick, setTrafficLastTick] = useState<{ events_written: number; last_db_event_at: string | null } | null>(null);

  const [supportUserId, setSupportUserId] = useState<string>("");
  const [supportNote, setSupportNote] = useState("");
  const [supportTicketCategory, setSupportTicketCategory] = useState("support_general");
  const [supportTicketNote, setSupportTicketNote] = useState("");

  const [assistantQuestion, setAssistantQuestion] = useState("Где сейчас главный риск в продукте и что сделать первым шагом?");
  const [assistantAnswer, setAssistantAnswer] = useState<any>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const [roleReason, setRoleReason] = useState("Операционное назначение");
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [rbacSearch, setRbacSearch] = useState("");

  const [limitsDraft, setLimitsDraft] = useState<any>(null);
  const [qualityMapDraft, setQualityMapDraft] = useState({ event_name: "", family: "events", display_ru: "" });

  const [riskSelected, setRiskSelected] = useState<string[]>([]);

  const [helpMode, setHelpMode] = useState(false);
  const [summarySnapshot, setSummarySnapshot] = useState<{ savedAt: string; data: any } | null>(null);
  const [helpTexts, setHelpTexts] = useState<Record<string, any>>(DEFAULT_HELP_TEXTS);
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  const [userSort, setUserSort] = useState<"created_desc" | "activity_7d" | "reports_7d" | "connect_sent_7d" | "reply_rate" | "risk_score">("activity_7d");
  const [riskQuery, setRiskQuery] = useState("");
  const [drillMetric, setDrillMetric] = useState<string | null>(null);
  const [drilldownAutoMapLoading, setDrilldownAutoMapLoading] = useState(false);
  const [drilldownExperimentLoading, setDrilldownExperimentLoading] = useState(false);
  const [updatedBadge, setUpdatedBadge] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryingData, setRetryingData] = useState(false);

  const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 90;
  const summarySegment = ["all", "verified", "new", "active"].includes(segment) ? segment : "all";

  const health = useQuery({
    queryKey: ["admin-health-v2"],
    queryFn: () => adminApi("/api/admin/health", adminHealthResponseSchema),
    retry: false,
    refetchInterval: 10000,
  });

  const healthOk = health.data?.ok === true;

  const access = useQuery({
    queryKey: ["admin-access-v1"],
    queryFn: () => api<any>("/api/admin/access"),
    enabled: healthOk,
    staleTime: 30_000,
  });

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("admin_help_mode") : null;
    setHelpMode(saved === "1");

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(ADMIN_SUMMARY_SNAPSHOT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { savedAt: string; data: any };
          if (parsed?.data) setSummarySnapshot(parsed);
        } catch {}
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin_help_mode", helpMode ? "1" : "0");
  }, [helpMode]);

  const markUpdated = (key: string) => {
    setUpdatedBadge(key);
    window.setTimeout(() => setUpdatedBadge((prev) => (prev === key ? null : prev)), 2200);
  };

  const summary = useQuery({
    queryKey: ["admin-summary-v2", days, summarySegment],
    queryFn: () => adminApi(`/api/admin/metrics/summary?days=${days}&segment=${summarySegment}`, metricsSummaryResponseSchema),
    enabled: healthOk,
    staleTime: 12_000,
    retry: 1,
    retryDelay: 700,
    refetchInterval: section === "traffic" || section === "overview" || section === "operations" ? 10_000 : 20_000,
  });

  useEffect(() => {
    if (!summary.data || typeof window === "undefined") return;
    const snapshot = { savedAt: new Date().toISOString(), data: summary.data };
    setSummarySnapshot(snapshot);
    window.localStorage.setItem(ADMIN_SUMMARY_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }, [summary.data]);

  const helpTextsQuery = useQuery({
    queryKey: ["admin-help-texts"],
    queryFn: () => api<any>("/api/admin/help-texts"),
    enabled: healthOk,
    staleTime: 60_000,
  });

  const drilldown = useQuery({
    queryKey: ["admin-metric-drilldown", drillMetric, days, summarySegment],
    queryFn: () => api<any>("/api/admin/metrics/drilldown?metric=" + encodeURIComponent(drillMetric || "") + "&days=" + days + "&segment=" + summarySegment),
    enabled: healthOk && Boolean(drillMetric),
  });

  const users = useQuery({
    queryKey: ["admin-users-v7", userFilter, userSort],
    queryFn: () =>
      adminApi(
        `/api/admin/users/search?q=${encodeURIComponent(userFilter.q)}&limit=50&demo=${userFilter.demo}&role=${encodeURIComponent(userFilter.role)}&shadow_banned=${userFilter.shadow_banned}&message_limited=${userFilter.message_limited}&profile_completed=${userFilter.profile_completed}&city=${encodeURIComponent(userFilter.city)}&sort=${encodeURIComponent(userSort)}`,
        userSearchResponseSchema,
      ),
    enabled: healthOk && (section === "users" || section === "support"),
  });

  const liveEvents = useQuery({
    queryKey: ["admin-events-live-v2", eventsFilter],
    queryFn: () =>
      adminApi(
        `/api/admin/events/live?event_name=${encodeURIComponent(eventsFilter.eventName)}&user_id=${encodeURIComponent(eventsFilter.userId)}&demo_group=${encodeURIComponent(eventsFilter.demoGroup)}&limit=500`,
        liveEventsResponseSchema,
      ),
    enabled: healthOk && section === "events_live",
    refetchInterval: section === "events_live" ? 4000 : false,
  });

  const trafficCoverageEvents = useQuery({
    queryKey: ["admin-traffic-coverage-events"],
    queryFn: () => adminApi("/api/admin/events/live?demo_group=traffic&limit=900", liveEventsResponseSchema),
    enabled: healthOk && section === "traffic",
    refetchInterval: section === "traffic" ? 5000 : false,
  });

  const trafficStatus = useQuery({
    queryKey: ["admin-traffic-status-v3"],
    queryFn: () => api<any>("/api/admin/traffic/status"),
    enabled: healthOk && (section === "traffic" || section === "operations"),
    staleTime: 2_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: section === "traffic" || section === "operations" ? 4_000 : false,
  });

  const trafficProof = useQuery({
    queryKey: ["admin-traffic-proof-v3"],
    queryFn: () => api<{ events_last_window: number; last_event_at: string | null }>("/api/admin/traffic/proof?minutes=2"),
    enabled: healthOk && (section === "traffic" || section === "operations"),
    staleTime: 2_000,
    refetchInterval: section === "traffic" || section === "operations" ? 5_000 : false,
  });

  const operations = useQuery({
    queryKey: ["admin-operations-overview"],
    queryFn: () => api<any>("/api/admin/operations/overview"),
    enabled: healthOk && section === "operations",
    refetchInterval: 7000,
  });

  const auditLog = useQuery({
    queryKey: ["admin-audit-log", days],
    queryFn: () => api<any>(`/api/admin/audit/log?days=${days}`),
    enabled: healthOk && (section === "audit" || section === "security"),
  });

  const supportDesk = useQuery({
    queryKey: ["admin-support-desk", search, supportUserId],
    queryFn: () => api<any>(`/api/admin/support/desk?q=${encodeURIComponent(search)}&user_id=${encodeURIComponent(supportUserId)}`),
    enabled: healthOk && section === "support",
    refetchInterval: 8000,
  });

  const rbac = useQuery({
    queryKey: ["admin-rbac-admins"],
    queryFn: () => api<any>("/api/admin/rbac/admins"),
    enabled: healthOk && section === "rbac",
  });

  const rbacLookup = useQuery({
    queryKey: ["admin-rbac-lookup", rbacSearch],
    queryFn: () =>
      adminApi(
        `/api/admin/users/search?q=${encodeURIComponent(rbacSearch)}&limit=12&demo=all&role=all&shadow_banned=false&message_limited=false&profile_completed=false&city=&sort=created_desc`,
        userSearchResponseSchema,
      ),
    enabled: healthOk && section === "rbac" && rbacSearch.trim().length >= 2,
  });

  const flags = useQuery({
    queryKey: ["admin-feature-flags-v2"],
    queryFn: () => api<any>("/api/admin/feature-flags"),
    enabled: healthOk && (section === "flags" || section === "config"),
  });

  const limits = useQuery({
    queryKey: ["admin-config-limits"],
    queryFn: () => api<any>("/api/admin/config/limits"),
    enabled: healthOk && section === "config",
  });

  const alerts = useQuery({
    queryKey: ["admin-alerts-v2"],
    queryFn: () => api<any>("/api/admin/alerts"),
    enabled: healthOk && (section === "alerts" || section === "operations"),
  });

  const reports = useQuery({
    queryKey: ["admin-reports-v2"],
    queryFn: () => api<any>("/api/admin/reports"),
    enabled: healthOk && (section === "reports" || section === "moderation" || section === "support"),
  });

  const risk = useQuery({
    queryKey: ["admin-risk-v2", riskQuery],
    queryFn: () => api<any>(`/api/admin/risk?q=${encodeURIComponent(riskQuery)}`),
    enabled: healthOk && (section === "risk" || section === "moderation" || section === "operations"),
  });

  const quality = useQuery({
    queryKey: ["admin-data-quality"],
    queryFn: () => api<any>("/api/admin/data-quality"),
    enabled: healthOk && section === "data_quality",
    refetchInterval: 15000,
  });

  const security = useQuery({
    queryKey: ["admin-security-overview"],
    queryFn: () => api<any>("/api/admin/security/overview"),
    enabled: healthOk && (section === "security" || section === "backup"),
  });

  const integrations = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: () => api<any>("/api/admin/integrations/status"),
    enabled: healthOk && (section === "integrations" || section === "operations"),
  });

  const settings = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: () => api<any>("/api/admin/system/settings"),
    enabled: healthOk && section === "system",
  });

  const experiments = useQuery({
    queryKey: ["admin-experiments"],
    queryFn: () => api<any>("/api/admin/experiments"),
    enabled: healthOk && section === "experiments",
  });

  const retention = useQuery({
    queryKey: ["admin-retention", days],
    queryFn: () => api<any>(`/api/admin/metrics/retention?days=${days}`),
    enabled: healthOk && section === "retention",
  });

  useEffect(() => {
    if (limits.data?.limits) {
      setLimitsDraft(limits.data.limits);
    }
  }, [limits.data]);

  useEffect(() => {
    if (helpTextsQuery.data?.texts) {
      setHelpTexts({ ...DEFAULT_HELP_TEXTS, ...helpTextsQuery.data.texts });
    }
  }, [helpTextsQuery.data]);

  const trafficStatusSoftError = isTrafficStatusSoftError(trafficStatus.error);

  const activeErrors = [
    health.error,
    summarySnapshot?.data ? null : summary.error,
    helpTextsQuery.error,
    drilldown.error,
    users.error,
    liveEvents.error,
    trafficStatusSoftError ? null : trafficStatus.error,
    trafficProof.error,
    operations.error,
    auditLog.error,
    supportDesk.error,
    rbac.error,
    flags.error,
    limits.error,
    alerts.error,
    reports.error,
    risk.error,
    quality.error,
    security.error,
    integrations.error,
    settings.error,
    experiments.error,
    retention.error,
    access.error,
  ]
    .filter(Boolean)
    .map(parseError);

  const retryDataRequests = async () => {
    setRetryingData(true);
    try {
      await Promise.all([
        health.refetch(),
        summary.refetch(),
        operations.refetch(),
        trafficStatus.refetch(),
        trafficProof.refetch(),
        users.refetch(),
        liveEvents.refetch(),
        reports.refetch(),
        risk.refetch(),
        alerts.refetch(),
      ]);
    } finally {
      setRetryingData(false);
    }
  };

  useEffect(() => {
    if (!healthOk || !activeErrors.length) {
      setRetryAttempt(0);
      return;
    }

    const delay = Math.min(15000, 2000 * Math.pow(2, Math.min(retryAttempt, 3)));
    const timer = window.setTimeout(() => {
      void retryDataRequests().finally(() => {
        setRetryAttempt((prev) => prev + 1);
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [healthOk, activeErrors.length, retryAttempt]);

  useEffect(() => {
    if (!trafficStatusSoftError) return;
    const timer = window.setTimeout(() => {
      void trafficStatus.refetch();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [trafficStatusSoftError]);

  const coverage = useMemo(() => {
    const items = trafficCoverageEvents.data?.items ?? [];
    const since = Date.now() - 15 * 60 * 1000;
    const recent = items.filter((x) => new Date(x.created_at).getTime() >= since);
    const names = new Set(recent.map((x) => x.event_name));
    return REQUIRED_COVERAGE.map((item) => ({
      ...item,
      ok: item.aliases.some((a) => names.has(a)),
    }));
  }, [trafficCoverageEvents.data]);

  useEffect(() => {
    if (section !== "traffic") return;
    if (!["RUNNING", "STARTING", "DEGRADED"].includes(String(trafficStatus.data?.runtime_status ?? ""))) return;
    const runId = trafficStatus.data?.run?.id;
    if (!runId) return;

    const intervalMs = Math.max(3000, Math.min(15000, Number(trafficStatus.data?.run?.interval_sec ?? 8) * 1000));
    const timer = window.setInterval(() => {
      void api("/api/admin/traffic/tick", { method: "POST", body: JSON.stringify({ run_id: runId }) })
        .then((res: any) => setTrafficLastTick({ events_written: Number(res.events_written ?? 0), last_db_event_at: res.last_db_event_at ?? null }))
        .then(() => Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), operations.refetch(), trafficCoverageEvents.refetch()]))
        .catch(() => undefined);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [section, trafficStatus.data?.runtime_status, trafficStatus.data?.run?.id, trafficStatus.data?.run?.interval_sec]);

  const onTrafficStart = async () => {
    if (!canManageTraffic) return;
    try {
      setTrafficAction("start");
      setTrafficError(null);
      const startRes = await api<{ run_id?: string }>("/api/admin/traffic/start", { method: "POST", body: JSON.stringify(trafficForm) });
      await api<{ events_written: number; last_db_event_at: string | null }>("/api/admin/traffic/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: startRes?.run_id ?? null }),
      });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), operations.refetch(), trafficCoverageEvents.refetch(), users.refetch()]);
      setSection("traffic");
    } catch (e) {
      setTrafficError(parseError(e));
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficStop = async () => {
    if (!canManageTraffic) return;
    try {
      setTrafficAction("stop");
      setTrafficError(null);
      await api("/api/admin/traffic/stop", { method: "POST", body: JSON.stringify({ run_id: trafficStatus.data?.run?.id ?? null }) });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), operations.refetch()]);
    } catch (e) {
      setTrafficError(parseError(e));
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficTick = async () => {
    if (!canManageTraffic) return;
    try {
      setTrafficAction("tick");
      setTrafficError(null);
      const res = await api<{ events_written: number; last_db_event_at: string | null }>("/api/admin/traffic/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: trafficStatus.data?.run?.id ?? null }),
      });
      setTrafficLastTick(res);
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), operations.refetch(), trafficCoverageEvents.refetch(), users.refetch()]);
    } catch (e) {
      setTrafficError(parseError(e));
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficReset = async () => {
    if (!canManageTraffic) return;
    try {
      setTrafficAction("reset");
      setTrafficError(null);
      await api("/api/admin/traffic/reset", { method: "POST" });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), users.refetch(), trafficCoverageEvents.refetch(), liveEvents.refetch(), operations.refetch()]);
    } catch (e) {
      setTrafficError(parseError(e));
    } finally {
      setTrafficAction(null);
    }
  };

  const runUserAction = async (userId: string, action: string) => {
    if (!canManageUsers) return;
    await api(`/api/admin/users/${userId}/actions`, { method: "POST", body: JSON.stringify({ action, reason: "admin_panel_action" }) });
    await Promise.all([users.refetch(), summary.refetch(), risk.refetch(), reports.refetch(), auditLog.refetch()]);
  };

  const runBulkRiskAction = async (action: "limit_messaging" | "shadowban" | "block" | "mark_safe") => {
    if (!canManageRisk) return;
    const ids = [...riskSelected].slice(0, 10);
    for (const id of ids) {
      await api(`/api/admin/users/${id}/actions`, { method: "POST", body: JSON.stringify({ action, reason: "risk_bulk_action" }) });
    }
    setRiskSelected([]);
    await Promise.all([risk.refetch(), users.refetch(), summary.refetch(), auditLog.refetch()]);
  };

  const updateAlertStatus = async (item: any, status: "active" | "paused" | "triggered") => {
    await api("/api/admin/alerts", {
      method: "POST",
      body: JSON.stringify({
        id: item.id,
        type: item.type,
        metric: item.metric,
        threshold: Number(item.threshold ?? 0),
        window_days: Number(item.window_days ?? 7),
        status,
      }),
    });
    await Promise.all([alerts.refetch(), operations.refetch(), auditLog.refetch()]);
    markUpdated("alert");
  };

  const updateReportStatus = async (id: string, status: "open" | "in_review" | "resolved" | "rejected") => {
    await api("/api/admin/reports", {
      method: "PUT",
      body: JSON.stringify({ id, status }),
    });
    await Promise.all([reports.refetch(), summary.refetch(), operations.refetch(), auditLog.refetch()]);
    markUpdated("report");
  };

  const addSupportNote = async () => {
    if (!supportUserId || supportNote.trim().length < 2) return;
    await api("/api/admin/support/notes", { method: "POST", body: JSON.stringify({ user_id: supportUserId, text: supportNote.trim() }) });
    setSupportNote("");
    await Promise.all([supportDesk.refetch(), auditLog.refetch()]);
    markUpdated("support-note");
  };

  const createSupportTicket = async () => {
    if (!supportUserId || supportTicketCategory.trim().length < 2) return;
    await api("/api/admin/support/tickets", {
      method: "POST",
      body: JSON.stringify({
        user_id: supportUserId,
        category: supportTicketCategory,
        internal_note: supportTicketNote || null,
      }),
    });
    setSupportTicketNote("");
    await Promise.all([supportDesk.refetch(), auditLog.refetch()]);
    markUpdated("support-ticket");
  };

  const updateTicket = async (id: string, status: "open" | "in_progress" | "resolved") => {
    await api("/api/admin/support/tickets", { method: "PUT", body: JSON.stringify({ id, status }) });
    await Promise.all([supportDesk.refetch(), auditLog.refetch()]);
    markUpdated("support-ticket");
  };

  const updateRole = async (userId: string) => {
    if (!canManageRoles) return;
    const role = roleDraft[userId];
    if (!role) return;
    await api("/api/admin/rbac/admins", { method: "PUT", body: JSON.stringify({ user_id: userId, role, reason: roleReason }) });
    await Promise.all([rbac.refetch(), auditLog.refetch()]);
    markUpdated("rbac-role");
  };

  const toggleFlag = async (flag: any) => {
    await api("/api/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify({
        id: flag.id,
        key: flag.key,
        enabled: !flag.enabled,
        rollout: Number(flag.rollout ?? 100),
        scope: flag.scope ?? "global",
        payload: flag.payload ?? {},
        description: flag.description ?? undefined,
      }),
    });
    await Promise.all([flags.refetch(), auditLog.refetch(), operations.refetch()]);
    markUpdated("feature-flag");
  };

  const saveLimits = async () => {
    if (!limitsDraft) return;
    await api("/api/admin/config/limits", {
      method: "PUT",
      body: JSON.stringify({ ...limitsDraft, reason: "manual_update_from_config_center" }),
    });
    await Promise.all([limits.refetch(), auditLog.refetch()]);
    markUpdated("limits");
  };

  const addToDictionary = async () => {
    if (!qualityMapDraft.event_name || !qualityMapDraft.display_ru) return;
    await api("/api/admin/data-quality", {
      method: "POST",
      body: JSON.stringify(qualityMapDraft),
    });
    setQualityMapDraft({ event_name: "", family: "events", display_ru: "" });
    await Promise.all([quality.refetch(), auditLog.refetch()]);
    markUpdated("event-dictionary");
  };

  const askAssistant = async () => {
    try {
      setAssistantLoading(true);
      const res = await api<any>("/api/admin/assistant", { method: "POST", body: JSON.stringify({ question: assistantQuestion }) });
      setAssistantAnswer(res);
    } finally {
      setAssistantLoading(false);
    }
  };

  const downloadCSV = (table: string) => {
    window.open(`/api/admin/export?table=${encodeURIComponent(table)}`, "_blank", "noopener,noreferrer");
  };

  const downloadSnapshot = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      period_days: days,
      segment,
      summary: summaryData?.kpis ?? {},
      top_events_24h: summaryData?.tables?.top_events_24h ?? [],
      funnel: summaryData?.funnel?.steps ?? [],
      warnings: summaryData?.warnings ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetap_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricEventAlias = (metric: string | null) => {
    if (!metric) return "";
    if (metric.includes("duo")) return "post_published_daily_duo";
    if (metric.includes("video")) return "post_published_video";
    if (metric.includes("event_join")) return "event_joined";
    if (metric.includes("event_view")) return "event_viewed";
    if (metric.includes("connect_replied") || metric === "reply_rate") return "connect_replied";
    if (metric.includes("connect_sent")) return "connect_sent";
    if (metric.includes("message")) return "chat_message_sent";
    if (metric.includes("report")) return "report_created";
    if (metric.includes("tg_verify") || metric.includes("registration")) return "auth.telegram_verified";
    return "";
  };

  const openEventsFromDrilldown = () => {
    const eventName = metricEventAlias(drillMetric);
    setEventsFilter((prev) => ({ ...prev, eventName }));
    setSection("events_live");
  };

  const createAlertFromDrilldown = async () => {
    if (!drillMetric || !drilldown.data) return;
    const base = Number(drilldown.data.current_value ?? 0);
    const threshold = Number.isFinite(base) && base > 0 ? Number((base * 1.15).toFixed(2)) : 1;
    await api("/api/admin/alerts", {
      method: "POST",
      body: JSON.stringify({ type: "kpi_watch", metric: drillMetric, threshold, window_days: days, status: "active" }),
    });
    markUpdated("alert-" + drillMetric);
    await Promise.all([alerts.refetch(), auditLog.refetch()]);
  };

  const createExperimentFromDrilldown = async () => {
    if (!drillMetric || !drilldown.data) return;
    try {
      setDrilldownExperimentLoading(true);
      const key = ("auto_" + String(drillMetric).replace(/[^a-zA-Z0-9_]+/g, "_") + "_" + String(Date.now()).slice(-6)).toLowerCase();
      await api("/api/admin/experiments", {
        method: "POST",
        body: JSON.stringify({
          key,
          variants: { A: { label: "control" }, B: { label: "treatment" } },
          rollout_percent: 30,
          status: "draft",
          primary_metric: drillMetric,
        }),
      });
      markUpdated("experiment-" + drillMetric);
      await Promise.all([experiments.refetch(), auditLog.refetch()]);
      setSection("experiments");
    } finally {
      setDrilldownExperimentLoading(false);
    }
  };

  const autoMapMetricFromDrilldown = async () => {
    if (!drillMetric) return;
    try {
      setDrilldownAutoMapLoading(true);
      const res = await api<any>("/api/admin/metrics/drilldown", {
        method: "POST",
        body: JSON.stringify({ metric: drillMetric, days, segment: summarySegment }),
      });
      markUpdated("auto-map:" + String(res && res.mapped_count ? res.mapped_count : 0));
      await Promise.all([drilldown.refetch(), quality.refetch(), auditLog.refetch()]);
    } finally {
      setDrilldownAutoMapLoading(false);
    }
  };

  const metricsKeys = KPI_GROUPS[metricsTab] ?? [];
  const summaryData = summary.data ?? summarySnapshot?.data ?? null;
  const summaryCache: any = (summary.data as any)?.cache ?? (summarySnapshot as any)?.data?.cache ?? null;
  const summaryCacheMode = summaryCache?.mode ?? null;
  const summaryCachedAt = summaryCache?.cached_at ?? summarySnapshot?.savedAt ?? null;
  const kpis = summaryData?.kpis ?? {};
  const offlineSnapshotMode = !healthOk && Boolean(summarySnapshot?.data);
  const viewReady = healthOk || offlineSnapshotMode;
  const showSectionGuide = viewReady && section !== "guide";
  const canManageUsers = roleHasPermission(access.data?.role ?? "", "users.action");
  const canManageRisk = roleHasPermission(access.data?.role ?? "", "risk.manage");
  const canManageRoles = Boolean(rbac.data?.can_manage_roles) && roleHasPermission(access.data?.role ?? "", "rbac.manage");
  const canManageTraffic = roleHasPermission(access.data?.role ?? "", "traffic.manage");
  const rbacLookupItems = rbacLookup.data?.items ?? [];

  return (
    <AdminShell
      section={section}
      onSectionChange={setSection}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      segment={segment}
      onSegmentChange={setSegment}
      onAskAI={() => setSection("assistant")}
      search={search}
      onSearch={(v) => {
        setSearch(v);
        setUserFilter((prev) => ({ ...prev, q: v }));
      }}
      helpMode={helpMode}
      onHelpModeChange={setHelpMode}
      role={access.data?.role ?? null}
    >
      {!healthOk ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>{health.data?.code === "SERVICE_ROLE_UNAVAILABLE" ? "Degraded mode: Service Role недоступен" : "Не подключено: Admin Health Check"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {health.isLoading ? (
                <p className="inline-flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Проверяю окружение и БД…</p>
              ) : (
                <>
                  {health.data ? (
                    <>
                      <p>Режим: <strong>{health.data.mode === "degraded" ? "DEGRADED" : "NORMAL"}</strong></p>
                      <p>Статус БД: <strong>{health.data.db.connected ? "OK" : "ERROR"}</strong></p>
                      <p>ENV: URL={String(health.data.env.NEXT_PUBLIC_SUPABASE_URL)} · ANON={String(health.data.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} · SERVICE={String(health.data.env.SUPABASE_SERVICE_ROLE_KEY)}</p>
                      {health.data.checks ? (
                        <p>Checks: service={String(health.data.checks.service_role_probe)} · users={String(health.data.checks.users_probe)} · analytics={String(health.data.checks.analytics_table_exists)}</p>
                      ) : null}
                      {health.data.code === "SERVICE_ROLE_UNAVAILABLE" ? (
                        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                          <p className="mb-1 font-medium text-warning">Degraded mode</p>
                          <p>1. Проверь SUPABASE_SERVICE_ROLE_KEY в Vercel Production</p>
                          <p>2. Выполни redeploy проекта</p>
                        </div>
                      ) : null}
                      {health.data.issues.length ? (
                        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
                          <p className="mb-1 font-medium text-danger">Проблемы</p>
                          {health.data.issues.map((x) => <p key={x}>• {x}</p>)}
                        </div>
                      ) : null}
                      {health.data.steps.length ? (
                        <div className="rounded-xl border border-border bg-surface2/70 p-3">
                          <p className="mb-1 font-medium">Как исправить</p>
                          {health.data.steps.map((x) => <p key={x}>1. {x}</p>)}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {health.error ? <p className="text-danger">{parseError(health.error)}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => health.refetch()} className="active:scale-[0.98] transition-transform"><RefreshCw className="mr-1 h-4 w-4" />Повторить проверку</Button>
                    <Button variant="secondary" onClick={() => window.open("/api/admin/health/debug", "_blank", "noopener,noreferrer")}>Health debug</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {offlineSnapshotMode ? (
        <div className="col-span-12">
          <Card className="border-blue/30 bg-blue/10">
            <CardHeader><CardTitle>Offline snapshot mode</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Онлайн-проверка временно недоступна. Показана последняя сохраненная сводка метрик.</p>
              <p>Snapshot: <strong>{summarySnapshot?.savedAt ? new Date(summarySnapshot.savedAt).toLocaleString("ru-RU") : "—"}</strong></p>
              <p className="text-xs text-muted">Деструктивные действия отключены до восстановления подключения.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => health.refetch()}><RefreshCw className="mr-1 h-4 w-4" />Проверить подключение</Button>
                <Button variant="secondary" onClick={() => setSection("events_live")}>Перейти в Events Stream</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && summaryCacheMode === "stale" ? (
        <div className="col-span-12">
          <Card className="border-warning/30 bg-warning/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <p>Показаны кэшированные данные. Обновлено: <strong>{summaryCachedAt ? new Date(summaryCachedAt).toLocaleString("ru-RU") : "—"}</strong></p>
              <Button onClick={() => retryDataRequests()} disabled={retryingData}>
                <RefreshCw className={retryingData ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} />
                {retryingData ? "Обновляем..." : "Повторить"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && activeErrors.length ? (
        <div className="col-span-12">
          <Card className="border-warning/30 bg-warning/10">
            <CardHeader><CardTitle>Проблемы загрузки данных</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                {activeErrors.slice(0, 10).map((x) => <p key={x}>• {x}</p>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => retryDataRequests()} disabled={retryingData}>
                  <RefreshCw className={retryingData ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} />
                  {retryingData ? "Повторяем..." : "Повторить"}
                </Button>
                <p className="text-xs text-muted">Автоповтор включен (backoff): попытка #{retryAttempt + 1}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && updatedBadge ? (
        <div className="col-span-12">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-200">Updated: {updatedBadge}</div>
        </div>
      ) : null}

      {showSectionGuide ? (
        <div className="col-span-12">
          <SectionGuideCard section={section} helpMode={helpMode} onOpenGuide={() => setHelpSheetOpen(true)} />
        </div>
      ) : null}

      {viewReady && section === "overview" ? (
        <>
          <div className="col-span-12">
            <Card>
              <CardHeader><CardTitle>Overview · KPI в цифрах</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {summary.isLoading ? <p className="text-sm text-muted">Загрузка метрик…</p> : <KpiGrid kpis={kpis} onSelect={setDrillMetric} helpMode={helpMode} helpTexts={helpTexts} />}
                {summaryData?.warnings?.length ? (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    {summaryData.warnings.map((w: string) => <p key={w}>• {w}</p>)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top events 24h</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(summaryData?.tables.top_events_24h ?? []).length ? (
                  summaryData?.tables.top_events_24h.map((r: { event_name: string; count: number }) => <p key={r.event_name} className="flex justify-between"><span>{r.event_name}</span><strong>{r.count}</strong></p>)
                ) : <EmptyNote text="За 24ч нет событий из выбранной категории" onOpenStream={() => setSection("events_live")} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(summaryData?.funnel.steps ?? []).length ? (
                  summaryData?.funnel.steps.map((r: { step: string; users: number; conversion: number; dropoff: number }) => (
                    <p key={r.step} className="flex justify-between"><span>{r.step}</span><strong>{r.users} · {(r.conversion * 100).toFixed(1)}%</strong></p>
                  ))
                ) : <EmptyNote text="Нет данных funnel за период" onOpenStream={() => setSection("events_live")} />}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
      {viewReady && section === "guide" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">Как пользоваться (Guide)
                {helpMode ? (
                  <HelpTip compact {...(helpTexts["section.guide"] ?? DEFAULT_HELP_TEXTS["section.guide"])} />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 font-medium">5-минутный чеклист запуска</p>
                <p>1. Открой Operations и проверь health strip (events_last_5min &gt; 0).</p>
                <p>2. Нажми Start Traffic Generator, если тестируешь стенд.</p>
                <p>3. Открой Events Stream и убедись, что события идут в реальном времени.</p>
                <p>4. Перейди в Metrics Lab, кликни KPI и проверь Drilldown.</p>
                <p>5. Открой Users 360 и проверь timeline demo user.</p>
                <p>6. Открой Risk и проверь high-risk queue в chaos mode.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Плейбук: падает регистрация</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted">
                    <p>Смотри: Funnels → auth.* steps, затем Events Stream по auth.telegram_verified.</p>
                    <p>Тревога: verify rate резко ниже обычного уровня.</p>
                    <p>Действия: Integrations, webhook TG, fallback login path.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Плейбук: мало ответов на коннекты</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted">
                    <p>Смотри: Social KPI (reply_rate), top connectors, Risk Center.</p>
                    <p>Тревога: connect_sent растёт, connect_replied падает.</p>
                    <p>Действия: tighten limits, антиспам, подсказки в connect flow.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Плейбук: всплеск жалоб</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted">
                    <p>Смотри: Safety KPI, Reports Inbox, Risk signals.</p>
                    <p>Тревога: reports_count_24h выше базы в 2-3 раза.</p>
                    <p>Действия: bulk limit/shadowban/block + incident note.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Плейбук: дорогой AI</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted">
                    <p>Смотри: AI tab, ai_cost_total_24h, ai_error_rate, endpoint usage.</p>
                    <p>Тревога: cost растёт, а продуктовые KPI не улучшаются.</p>
                    <p>Действия: rate limits, retries policy, отключение дорогих путей.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setSection("operations")}>Открыть Operations</Button>
                <Button variant="secondary" onClick={() => setSection("events_live")}>Открыть Events Stream</Button>
                <Button variant="secondary" onClick={() => setSection("metrics_lab")}>Открыть Metrics Lab</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}


      {healthOk && section === "operations" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle className="inline-flex items-center gap-2"><Workflow className="h-5 w-5" />Operations Center {helpMode ? <HelpTip compact {...(helpTexts["section.operations"] ?? DEFAULT_HELP_TEXTS["section.operations"])} /> : null}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4 text-sm"><p className="font-medium text-[rgb(var(--peach-rgb))]">Events last 5m</p><p className="text-xl font-semibold">{operations.data?.status_strip?.events_last_5min ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="font-medium text-[rgb(var(--peach-rgb))]">TG verify 15m</p><p className="text-xl font-semibold">{formatKpi("tg_verify_rate", Number(operations.data?.status_strip?.tg_verify_success_rate_15min ?? 0))}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="font-medium text-[rgb(var(--peach-rgb))]">AI error rate 15m</p><p className="text-xl font-semibold">{formatKpi("ai_error_rate", Number(operations.data?.status_strip?.ai_error_rate_15min ?? 0))}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="font-medium text-[rgb(var(--peach-rgb))]">Reports 1h</p><p className="text-xl font-semibold">{operations.data?.status_strip?.reports_1h ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="font-medium text-[rgb(var(--peach-rgb))]">Risk high count</p><p className="text-xl font-semibold">{operations.data?.status_strip?.risk_high_count ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">API p95 latency</p><p className="text-xl font-semibold">{operations.data?.status_strip?.api_latency_p95_1h ?? 0} ms</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">AI cost today</p><p className="text-xl font-semibold">${Number(operations.data?.status_strip?.ai_cost_today ?? 0).toFixed(4)}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">Last event</p><p className="text-sm font-semibold">{operations.data?.status_strip?.last_event_at ? new Date(operations.data.status_strip.last_event_at).toLocaleString("ru-RU") : "—"}</p></CardContent></Card>
              </div>

              {helpMode ? (
                <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs">
                  <p className="mb-2 font-medium">Что это значит?</p>
                  <div className="flex flex-wrap gap-2">
                    <HelpTip compact title="Data pipeline" body="Поток событий в аналитике" why="Без него метрики не считаются" influence="Проверяйте Events Stream" normal="events_last_5min > 0" next="Если 0, проверь tracking" />
                    <HelpTip compact title="Auth/TG verify" body="Стабильность шага верификации" why="Влияет на конверсию регистрации" influence="Чинится через Integrations" normal="без резких провалов" next="Проверь auth.telegram_verified" />
                    <HelpTip compact title="AI health" body="Ошибки и стоимость AI" why="Контроль качества и затрат" influence="Лимиты и retry policy" normal="низкий error rate" next="Открой AI tab" />
                    <HelpTip compact title="Safety" body="Жалобы и риск" why="Показывает токсичность системы" influence="Risk actions и limits" normal="без spike" next="Открой Reports/Risk" />
                  </div>
                </div>
              ) : null}

              {(operations.data?.warnings ?? []).length ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                  {(operations.data?.warnings ?? []).map((w: string) => <p key={w}>• {w}</p>)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Active Alerts</CardTitle></CardHeader>
              <CardContent className="max-h-[420px] space-y-2 overflow-auto text-sm">
                {(alerts.data?.items ?? []).length ? (
                  (alerts.data?.items ?? []).map((item: any) => (
                    <div key={item.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                      <p className="font-medium">{item.type} · {item.metric}</p>
                      <p className="text-xs text-muted">status: {item.status} · threshold: {item.threshold}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" className="active:scale-[0.98]" onClick={() => updateAlertStatus(item, "paused")}>Ack</Button>
                        <Button size="sm" variant="secondary" className="active:scale-[0.98]" onClick={() => updateAlertStatus(item, "active")}>Re-open</Button>
                        <Button size="sm" variant="secondary" className="active:scale-[0.98]" onClick={() => setSection("guide")}>Как исправить</Button>
                      </div>
                    </div>
                  ))
                ) : <EmptyNote text="Нет активных алертов" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Incident Timeline</CardTitle></CardHeader>
              <CardContent className="max-h-[420px] space-y-2 overflow-auto text-sm">
                {(operations.data?.incident_timeline ?? []).length ? (
                  (operations.data.incident_timeline ?? []).map((x: any) => (
                    <div key={x.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                      <p className="font-medium">{x.action}</p>
                      <p className="text-xs text-muted">{x.target_type}:{x.target_id ?? "—"} · {new Date(x.created_at).toLocaleString("ru-RU")}</p>
                    </div>
                  ))
                ) : <EmptyNote text="Инцидентов пока нет" />}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="secondary" className="active:scale-[0.98]" onClick={onTrafficStop}><Square className="mr-1 h-4 w-4" />Pause Traffic Generator</Button>
              <Button variant="secondary" className="active:scale-[0.98]" onClick={() => setSection("flags")}><Gauge className="mr-1 h-4 w-4" />Disable feature flag</Button>
              <Button variant="secondary" className="active:scale-[0.98]" onClick={() => api("/api/admin/system/settings", { method: "PUT", body: JSON.stringify({ key: "safe_mode", value: { enabled: true } }) }).then(() => settings.refetch())}><AlertTriangle className="mr-1 h-4 w-4" />Enable safe mode</Button>
              <Button variant="secondary" className="active:scale-[0.98]" onClick={downloadSnapshot}><Download className="mr-1 h-4 w-4" />Export last 24h snapshot</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {viewReady && section === "metrics_lab" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Metrics Lab (только цифры и таблицы)</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map((tab) => (
                  <Button key={tab} size="sm" variant={metricsTab === tab ? "default" : "secondary"} onClick={() => setMetricsTab(tab as keyof typeof KPI_GROUPS)}>
                    {TAB_LABELS[tab]}
                  </Button>
                ))}
              </div>
              {summary.isLoading ? <p className="text-sm text-muted">Загрузка метрик…</p> : <KpiGrid kpis={kpis} keys={metricsKeys} onSelect={setDrillMetric} helpMode={helpMode} helpTexts={helpTexts} />}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Breakdown by day</CardTitle></CardHeader>
              <CardContent className="max-h-[380px] space-y-1 overflow-auto text-sm">
                {(summaryData?.tables.breakdown_by_day ?? []).length ? (
                  summaryData?.tables.breakdown_by_day.map((r: { day: string; events: number; active_users: number; posts: number; joins: number; connect_sent: number; connect_replied: number }) => (
                    <p key={r.day} className="grid grid-cols-[120px_1fr] gap-2">
                      <span>{r.day}</span>
                      <span className="text-muted">events:{r.events} · users:{r.active_users} · posts:{r.posts} · joins:{r.joins} · connect:{r.connect_sent}/{r.connect_replied}</span>
                    </p>
                  ))
                ) : <EmptyNote text="Недостаточно данных за период" onOpenStream={() => setSection("events_live")} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top users 30d</CardTitle></CardHeader>
              <CardContent className="max-h-[380px] space-y-1 overflow-auto text-sm">
                {(summaryData?.tables.top_users_30d ?? []).length ? (
                  summaryData?.tables.top_users_30d.map((r: { user_id: string; events: number; posts: number; joins: number; connect_sent: number; connect_replied: number; city: string }) => (
                    <p key={r.user_id} className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="font-mono text-xs">{r.user_id.slice(0, 8)}</span>
                      <span className="text-muted">events:{r.events} · posts:{r.posts} · joins:{r.joins} · connect:{r.connect_sent}/{r.connect_replied} · {r.city}</span>
                    </p>
                  ))
                ) : <EmptyNote text="Нет данных топ-пользователей" />}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {viewReady && section === "funnels" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Funnels Table</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(summaryData?.funnel.steps ?? []).length ? (
                summaryData?.funnel.steps.map((r: { step: string; users: number; conversion: number; dropoff: number }) => (
                  <p key={r.step} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2">
                    <span>{r.step}</span>
                    <span className="text-right">{r.users}</span>
                    <span className="text-right">{(r.conversion * 100).toFixed(1)}%</span>
                    <span className="text-right">{(r.dropoff * 100).toFixed(1)}%</span>
                  </p>
                ))
              ) : <EmptyNote text="Нет событий funnel за период. Открой Events Stream и проверь трекинг." onOpenStream={() => setSection("events_live")} />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "retention" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Cohorts / Retention</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(retention.data?.cohorts ?? []).length ? (
                retention.data.cohorts.map((c: any) => (
                  <p key={c.cohortWeek} className="grid grid-cols-[140px_1fr_1fr_1fr_1fr] gap-2">
                    <span>{c.cohortWeek}</span>
                    <span className="text-right">size {c.cohortSize}</span>
                    <span className="text-right">D1 {(Number(c.d1Rate ?? 0) * 100).toFixed(1)}%</span>
                    <span className="text-right">D7 {(Number(c.d7Rate ?? 0) * 100).toFixed(1)}%</span>
                    <span className="text-right">D30 {(Number(c.d30Rate ?? 0) * 100).toFixed(1)}%</span>
                  </p>
                ))
              ) : <EmptyNote text="Недостаточно данных когорт. Запусти Traffic Generator." />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "events_live" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Events Stream</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input placeholder="event_name" value={eventsFilter.eventName} onChange={(e) => setEventsFilter((p) => ({ ...p, eventName: e.target.value }))} />
                <Input placeholder="user_id" value={eventsFilter.userId} onChange={(e) => setEventsFilter((p) => ({ ...p, userId: e.target.value }))} />
                <Input placeholder="demo_group" value={eventsFilter.demoGroup} onChange={(e) => setEventsFilter((p) => ({ ...p, demoGroup: e.target.value }))} />
                <Button variant="secondary" onClick={() => liveEvents.refetch()}><RefreshCw className="mr-1 h-4 w-4" />Обновить</Button>
              </div>

              <div className="max-h-[520px] space-y-1 overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
                {(liveEvents.data?.items ?? []).length ? (
                  liveEvents.data?.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[220px_160px_1fr_auto] gap-2 border-b border-border/30 py-1 text-xs last:border-b-0">
                      <span>{item.event_name}</span>
                      <span>{new Date(item.created_at).toLocaleString("ru-RU")}</span>
                      <span className="truncate text-muted">{item.user_id ?? "—"} · {item.summary ?? "—"}</span>
                      <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(item.properties ?? {}, null, 2))}>Copy JSON</Button>
                    </div>
                  ))
                ) : <EmptyNote text="Событий нет по текущим фильтрам" onOpenStream={() => setSection("events_live")} />}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "traffic" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Traffic Generator</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                <Input type="number" value={trafficForm.users_count} onChange={(e) => setTrafficForm((p) => ({ ...p, users_count: Number(e.target.value || 40) }))} />
                <Input type="number" value={trafficForm.interval_sec} onChange={(e) => setTrafficForm((p) => ({ ...p, interval_sec: Number(e.target.value || 8) }))} />
                <select className="admin-select" value={trafficForm.intensity} onChange={(e) => setTrafficForm((p) => ({ ...p, intensity: e.target.value as any }))}>
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
                <select className="admin-select" value={String(trafficForm.chaos)} onChange={(e) => setTrafficForm((p) => ({ ...p, chaos: e.target.value === "true" }))}>
                  <option value="true">chaos</option>
                  <option value="false">normal</option>
                </select>
                <Button onClick={onTrafficStart} disabled={trafficAction !== null || !canManageTraffic} title={!canManageTraffic ? "Недоступно для вашей роли" : undefined} className="active:scale-[0.98] transition-transform">{trafficAction === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start</Button>
                <Button variant="secondary" onClick={onTrafficStop} disabled={trafficAction !== null || !canManageTraffic} title={!canManageTraffic ? "Недоступно для вашей роли" : undefined} className="active:scale-[0.98] transition-transform">{trafficAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Stop</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onTrafficTick} disabled={trafficAction !== null || !canManageTraffic} title={!canManageTraffic ? "Недоступно для вашей роли" : undefined} className="active:scale-[0.98] transition-transform">{trafficAction === "tick" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Gauge className="mr-1 h-4 w-4" />} Tick</Button>
                <Button variant="secondary" onClick={onTrafficReset} disabled={trafficAction !== null || !canManageTraffic} title={!canManageTraffic ? "Недоступно для вашей роли" : undefined} className="active:scale-[0.98] transition-transform">{trafficAction === "reset" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Очистить демо</Button>
                <Button variant="secondary" onClick={() => Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), liveEvents.refetch(), operations.refetch(), trafficCoverageEvents.refetch()])}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
              </div>

              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p>Status: <strong>{trafficStatus.data?.runtime_status ?? "STOPPED"}</strong></p>
                <p>Total events: <strong>{trafficStatus.data?.total_events ?? 0}</strong></p>
                <p>DB events last 2m: <strong>{trafficProof.data?.events_last_window ?? 0}</strong></p>
                <p>Last event: <strong>{trafficProof.data?.last_event_at ? new Date(trafficProof.data.last_event_at).toLocaleString("ru-RU") : "—"}</strong></p>
                <p>Last tick: <strong>{trafficLastTick ? `${trafficLastTick.events_written} @ ${trafficLastTick.last_db_event_at ?? "—"}` : "—"}</strong></p>
              </div>

              {trafficStatusSoftError ? (
                <div className="rounded-xl border border-cyan/40 bg-cyan/10 p-3 text-cyan">Обновляем… статус генератора временно недоступен, повтор через 2 секунды.</div>
              ) : null}
              {trafficStatus.isFetching ? <p className="text-xs text-muted">Обновляем…</p> : null}

              {trafficProof.data && trafficStatus.data?.runtime_status === "RUNNING" && (trafficProof.data.events_last_window ?? 0) === 0 ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-danger">RUNNING (NO DB EVENTS). Проверь tick/status и diagnostics.</div>
              ) : null}
              {trafficError ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-danger">{trafficError}</div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Button Coverage (last 15 min)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {coverage.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-surface2/70 p-2">
                  <span>{item.label}</span>
                  <span className={`inline-flex items-center gap-1 ${item.ok ? "text-emerald-400" : "text-warning"}`}>
                    {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {item.ok ? "OK" : "MISSING"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "users" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Users 360</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
                <Input placeholder="email/username/телефон" value={userFilter.q} onChange={(e) => setUserFilter((p) => ({ ...p, q: e.target.value }))} />
                <select className="admin-select" value={userFilter.demo} onChange={(e) => setUserFilter((p) => ({ ...p, demo: e.target.value as any }))}>
                  <option value="all">all</option>
                  <option value="demo">demo</option>
                  <option value="real">real</option>
                  <option value="traffic">traffic</option>
                </select>
                <Input placeholder="role" value={userFilter.role} onChange={(e) => setUserFilter((p) => ({ ...p, role: e.target.value || "all" }))} />
                <Input placeholder="city" value={userFilter.city} onChange={(e) => setUserFilter((p) => ({ ...p, city: e.target.value }))} />
                <select className="admin-select" value={userSort} onChange={(e) => setUserSort(e.target.value as any)}>
                  <option value="activity_7d">activity_7d</option>
                  <option value="reports_7d">reports_7d</option>
                  <option value="connect_sent_7d">connect_sent_7d</option>
                  <option value="reply_rate">reply_rate</option>
                  <option value="risk_score">risk_score</option>
                  <option value="created_desc">created_desc</option>
                </select>
                <label className="flex items-center gap-2"><input type="checkbox" checked={userFilter.shadow_banned} onChange={(e) => setUserFilter((p) => ({ ...p, shadow_banned: e.target.checked }))} /> shadow</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={userFilter.message_limited} onChange={(e) => setUserFilter((p) => ({ ...p, message_limited: e.target.checked }))} /> limited</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={userFilter.profile_completed} onChange={(e) => setUserFilter((p) => ({ ...p, profile_completed: e.target.checked }))} /> profile done</label>
              </div>

              <div className="max-h-[620px] overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
                {(users.data?.items ?? []).length ? (
                  users.data?.items.map((u) => (
                    <div key={u.id} className="grid grid-cols-1 gap-2 border-b border-border/40 p-2 text-xs md:grid-cols-[160px_1fr_auto]">
                      <div>
                        <p className="font-medium text-text">{u.name}</p>
                        <p className="font-mono text-[11px] text-muted">{u.id}</p>
                        <p className="text-muted">{(u as any).email ?? "—"} · {(u as any).username ?? "—"}</p>
                        <p className="text-muted">{u.city ?? "—"} · role:{u.role}</p>
                      </div>
                      <div className="text-muted">
                        <p>posts:{u.posts_30d ?? 0} · joins:{u.joins_30d ?? 0} · sent:{u.connects_sent_30d ?? 0} · reply:{formatKpi("reply_rate", u.reply_rate ?? 0)}</p>
                        <p>flags:{u.openFlags} · reports(open):{u.openReports} · reports7d:{(u as any).reports_7d ?? 0} · risk:{u.risk_score ?? 0}</p>
                        <p>activity7d:{(u as any).activity_7d ?? 0} · connect7d:{(u as any).connect_sent_7d ?? 0}</p>
                        <p>status: {u.status}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => window.location.href = `/admin/users/${u.id}`}>open</Button>
                        <Button size="sm" variant="secondary" disabled={!canManageUsers} title={!canManageUsers ? "Нет прав" : undefined} onClick={() => runUserAction(u.id, u.message_limited ? "unlimit_messaging" : "limit_messaging")}>{u.message_limited ? "unlimit" : "limit"}</Button>
                        <Button size="sm" variant="secondary" disabled={!canManageUsers} title={!canManageUsers ? "Нет прав" : undefined} onClick={() => runUserAction(u.id, u.shadow_banned ? "unshadowban" : "shadowban")}>{u.shadow_banned ? "unshadow" : "shadow"}</Button>
                        <Button size="sm" variant={u.is_blocked ? "secondary" : "danger"} disabled={!canManageUsers} title={!canManageUsers ? "Нет прав" : undefined} onClick={() => runUserAction(u.id, u.is_blocked ? "unblock" : "block")}>{u.is_blocked ? "unblock" : "block"}</Button>
                      </div>
                    </div>
                  ))
                ) : <EmptyNote text="Пользователи не найдены" />}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "support" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle className="inline-flex items-center gap-2">Support Desk {helpMode ? <HelpTip compact {...(helpTexts["section.support"] ?? DEFAULT_HELP_TEXTS["section.support"])} /> : null}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
                <Input placeholder="Поиск user (id/username/email/phone masked)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Input placeholder="user_id (optional)" value={supportUserId} onChange={(e) => setSupportUserId(e.target.value)} />
                <Button variant="secondary" onClick={() => supportDesk.refetch()}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
              </div>

              <div className="max-h-[260px] overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
              {helpMode ? (
                <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">
                  <p className="font-medium text-text">PII правила для саппорта</p>
                  <p>• Не копируй полный телефон и email в заметки.</p>
                  <p>• Используй только masked значения и internal ticket id.</p>
                  <p>• При риске эскалируй модератору, не выдавай чувствительные данные.</p>
                </div>
              ) : null}

                {(supportDesk.data?.users ?? []).length ? (
                  supportDesk.data.users.map((u: any) => (
                    <div key={u.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/30 p-2 text-xs last:border-b-0">
                      <div>
                        <p className="font-medium">{u.name ?? u.username ?? u.id}</p>
                        <p className="text-muted">{u.id} · {u.phone_masked ?? "—"} · {u.city ?? "—"}</p>
                        <p className="text-muted">profile:{String(u.profile_completed)} · shadow:{String(u.shadow_banned)} · limited:{String(u.message_limited)} · last:{u.last_active_at ? new Date(u.last_active_at).toLocaleString("ru-RU") : "—"}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setSupportUserId(u.id)}>Выбрать</Button>
                    </div>
                  ))
                ) : <EmptyNote text="Пользователи не найдены" />}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <Input placeholder="Комментарий саппорта" value={supportNote} onChange={(e) => setSupportNote(e.target.value)} />
                  <Button onClick={addSupportNote} disabled={!supportUserId || supportNote.trim().length < 2}><Save className="mr-1 h-4 w-4" />Add note</Button>
                </div>
                <div className="max-h-[300px] overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
                  {(supportDesk.data?.notes ?? []).length ? (
                    supportDesk.data.notes.map((n: any) => (
                      <div key={n.id} className="border-b border-border/30 p-2 text-xs last:border-b-0">
                        <p className="font-medium">{n.text}</p>
                        <p className="text-muted">{n.author_role} · {new Date(n.created_at).toLocaleString("ru-RU")} · status: {n.status}</p>
                      </div>
                    ))
                  ) : <EmptyNote text="Заметок нет" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Tickets-lite</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input placeholder="category" value={supportTicketCategory} onChange={(e) => setSupportTicketCategory(e.target.value)} />
                  <Input placeholder="internal note" value={supportTicketNote} onChange={(e) => setSupportTicketNote(e.target.value)} />
                  <Button onClick={createSupportTicket} disabled={!supportUserId}><Save className="mr-1 h-4 w-4" />Create ticket</Button>
                </div>

                <div className="max-h-[300px] overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
                  {(supportDesk.data?.tickets ?? []).length ? (
                    supportDesk.data.tickets.map((t: any) => (
                      <div key={t.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/30 p-2 text-xs last:border-b-0">
                        <div>
                          <p className="font-medium">{t.category}</p>
                          <p className="text-muted">user:{t.user_id} · status:{t.status} · assignee:{t.assignee ?? "—"}</p>
                          <p className="text-muted">updated: {new Date(t.updated_at).toLocaleString("ru-RU")}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => updateTicket(t.id, "in_progress")}>Assign</Button>
                          <Button size="sm" variant="secondary" onClick={() => updateTicket(t.id, "resolved")}>Resolve</Button>
                        </div>
                      </div>
                    ))
                  ) : <EmptyNote text="Тикетов нет" />}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {healthOk && section === "audit" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Admin Audit Log</CardTitle></CardHeader>
            <CardContent className="max-h-[700px] space-y-2 overflow-auto text-sm">
              {(auditLog.data?.items ?? []).length ? (
                auditLog.data.items.map((x: any) => (
                  <div key={x.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                    <p className="font-medium">{x.action_type}</p>
                    <p className="text-xs text-muted">actor:{x.actor_name ?? x.admin_id} ({x.actor_role ?? "—"}) · target:{x.target_type}:{x.target_id ?? "—"}</p>
                    <p className="text-xs text-muted">{new Date(x.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                ))
              ) : <EmptyNote text="Аудит-лог пуст" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "config" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle className="inline-flex items-center gap-2">Config Center · Feature Flags {helpMode ? <HelpTip compact {...(helpTexts["section.config"] ?? DEFAULT_HELP_TEXTS["section.config"])} /> : null}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(flags.data?.flags ?? []).length ? (
                flags.data.flags.map((f: any) => (
                  <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-surface2/70 p-3">
                    <div>
                      <p className="font-medium">{f.key}</p>
                      <p className="text-xs text-muted">enabled:{String(f.enabled)} · rollout:{f.rollout}% · updated:{f.updated_at ? new Date(f.updated_at).toLocaleString("ru-RU") : "—"}</p>
                    </div>
                    <Button size="sm" variant={f.enabled ? "secondary" : "default"} onClick={() => toggleFlag(f)}>{f.enabled ? "Disable" : "Enable"}</Button>
                  </div>
                ))
              ) : <EmptyNote text="Feature flags не найдены" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Limits & Rules</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">
                <p><span className="text-text">Safe ranges:</span> connect_daily_limit: 5-20, message_rate_limit: 20-60, event_join_limit: 5-30.</p>
                <p>Изменения влияют на антиспам, скорость общения и воронку social.</p>
              </div>
              {limitsDraft ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                  <Input type="number" value={limitsDraft.connect_daily_limit ?? 10} onChange={(e) => setLimitsDraft((p: any) => ({ ...p, connect_daily_limit: Number(e.target.value || 0) }))} />
                  <Input type="number" value={limitsDraft.message_rate_limit ?? 30} onChange={(e) => setLimitsDraft((p: any) => ({ ...p, message_rate_limit: Number(e.target.value || 0) }))} />
                  <Input type="number" value={limitsDraft.event_join_limit ?? 20} onChange={(e) => setLimitsDraft((p: any) => ({ ...p, event_join_limit: Number(e.target.value || 0) }))} />
                  <Input type="number" value={limitsDraft.spam_connect_threshold ?? 30} onChange={(e) => setLimitsDraft((p: any) => ({ ...p, spam_connect_threshold: Number(e.target.value || 0) }))} />
                  <Input type="number" value={limitsDraft.spam_message_threshold ?? 40} onChange={(e) => setLimitsDraft((p: any) => ({ ...p, spam_message_threshold: Number(e.target.value || 0) }))} />
                </div>
              ) : <p className="text-muted">Загрузка лимитов...</p>}
              <Button onClick={saveLimits}><Save className="mr-1 h-4 w-4" />Apply limits</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "data_quality" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle className="inline-flex items-center gap-2">Data Quality {helpMode ? <HelpTip compact {...(helpTexts["section.data_quality"] ?? DEFAULT_HELP_TEXTS["section.data_quality"])} /> : null}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">
                <p><span className="text-text">Unknown events</span> — это event_name, которых нет в словаре.</p>
                <p>Если их много, метрики и воронки считаются некорректно.</p>
                <p>Решение: добавить маппинг через форму Add to dictionary.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">events_last_5min</p><p className="text-xl font-semibold">{quality.data?.volume?.events_last_5min ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">events_last_1h</p><p className="text-xl font-semibold">{quality.data?.volume?.events_last_1h ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">events_last_24h</p><p className="text-xl font-semibold">{quality.data?.volume?.events_last_24h ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4 text-sm"><p className="text-muted">unique_users_24h</p><p className="text-xl font-semibold">{quality.data?.volume?.unique_users_24h ?? 0}</p></CardContent></Card>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Top Event Names (24h)</CardTitle></CardHeader>
                  <CardContent className="max-h-[320px] overflow-auto text-sm">
                    {(quality.data?.top_event_names_24h ?? []).length ? (
                      quality.data.top_event_names_24h.map((r: any) => <p key={r.event_name} className="flex justify-between"><span>{r.event_name}</span><strong>{r.count}</strong></p>)
                    ) : <EmptyNote text="Нет событий" />}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Unknown / Unmapped Events</CardTitle></CardHeader>
                  <CardContent className="max-h-[320px] overflow-auto text-sm">
                    {(quality.data?.unknown_unmapped_events ?? []).length ? (
                      quality.data.unknown_unmapped_events.map((r: any) => <p key={r.event_name} className="flex justify-between"><span>{r.event_name}</span><strong>{r.count}</strong></p>)
                    ) : <EmptyNote text="Все события сопоставлены" />}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_1fr_auto]">
                <Input placeholder="event_name" value={qualityMapDraft.event_name} onChange={(e) => setQualityMapDraft((p) => ({ ...p, event_name: e.target.value }))} />
                <select className="admin-select" value={qualityMapDraft.family} onChange={(e) => setQualityMapDraft((p) => ({ ...p, family: e.target.value }))}>
                  <option value="auth">auth</option>
                  <option value="profile">profile</option>
                  <option value="feed">feed</option>
                  <option value="events">events</option>
                  <option value="social">social</option>
                  <option value="safety">safety</option>
                  <option value="ai">ai</option>
                  <option value="admin">admin</option>
                </select>
                <Input placeholder="display_ru" value={qualityMapDraft.display_ru} onChange={(e) => setQualityMapDraft((p) => ({ ...p, display_ru: e.target.value }))} />
                <Button onClick={addToDictionary}><Save className="mr-1 h-4 w-4" />Add to dictionary</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "exports" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Exports & Snapshots</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => downloadCSV("users")}><Download className="mr-1 h-4 w-4" />Export users CSV</Button>
                <Button variant="secondary" onClick={() => downloadCSV("events")}><Download className="mr-1 h-4 w-4" />Export events CSV</Button>
                <Button variant="secondary" onClick={() => downloadCSV("reports")}><Download className="mr-1 h-4 w-4" />Export reports CSV</Button>
                <Button variant="secondary" onClick={() => downloadCSV("feature_flags")}><Download className="mr-1 h-4 w-4" />Export flags CSV</Button>
                <Button variant="secondary" onClick={downloadSnapshot}><Download className="mr-1 h-4 w-4" />Investor snapshot JSON</Button>
              </div>
              <p className="text-muted">PII masked by default. Support/Analyst — only aggregate exports. Admin — extended exports.</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "rbac" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>RBAC & Admins</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Найди пользователя по username/email/phone"
                  value={rbacSearch}
                  onChange={(e) => setRbacSearch(e.target.value)}
                />
                <Input placeholder="Причина изменения роли" value={roleReason} onChange={(e) => setRoleReason(e.target.value)} />
                <Button variant="secondary" onClick={() => Promise.all([rbac.refetch(), rbacLookup.refetch()])}>Refresh</Button>
              </div>

              {!canManageRoles ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  Недостаточно прав для изменения ролей. Нужна роль admin или super_admin.
                </div>
              ) : null}

              {rbacSearch.trim().length < 2 ? (
                <p className="text-xs text-muted">Введи минимум 2 символа, чтобы назначить роль любому пользователю.</p>
              ) : rbacLookup.isLoading ? (
                <p className="inline-flex items-center gap-2 text-xs text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Ищем пользователей...</p>
              ) : (
                <div className="space-y-2">
                  {rbacLookupItems.length ? (
                    rbacLookupItems.map((u: any) => {
                      const roleValue = roleDraft[u.id] ?? u.role ?? "user";
                      return (
                        <div key={u.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface2/70 p-3 md:grid-cols-[1fr_auto_auto]">
                          <div>
                            <p className="font-medium">{u.name ?? u.username ?? u.email ?? u.id}</p>
                            <p className="text-xs text-muted">{u.id} · current:{u.role ?? "user"}</p>
                          </div>
                          <select
                            className="admin-select"
                            value={roleValue}
                            onChange={(e) => setRoleDraft((p) => ({ ...p, [u.id]: e.target.value }))}
                          >
                            {(rbac.data?.roles ?? ["user", "support", "moderator", "analyst", "admin"]).map((r: string) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => updateRole(u.id)}
                            disabled={!canManageRoles || roleReason.trim().length < 2}
                            title={!canManageRoles ? "Недостаточно прав" : undefined}
                          >
                            Apply
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyNote text="Пользователи не найдены" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Текущие администраторы</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(rbac.data?.admins ?? []).length ? (
                rbac.data.admins.map((u: any) => (
                  <div key={u.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface2/70 p-3 md:grid-cols-[1fr_auto_auto]">
                    <div>
                      <p className="font-medium">{u.name ?? u.username ?? u.email ?? u.id}</p>
                      <p className="text-xs text-muted">{u.id} · role:{u.role}</p>
                    </div>
                    <select className="admin-select" value={roleDraft[u.id] ?? u.role} onChange={(e) => setRoleDraft((p) => ({ ...p, [u.id]: e.target.value }))}>
                      {(rbac.data?.roles ?? ["user", "support", "moderator", "analyst", "admin"]).map((r: string) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Button size="sm" onClick={() => updateRole(u.id)} disabled={!canManageRoles || roleReason.trim().length < 2} title={!canManageRoles ? "Недостаточно прав" : undefined}>Apply</Button>
                  </div>
                ))
              ) : <EmptyNote text="Администраторы не найдены" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>История изменений ролей</CardTitle></CardHeader>
            <CardContent className="max-h-[320px] overflow-auto text-sm">
              {(rbac.data?.history ?? []).length ? (
                rbac.data.history.map((h: any) => (
                  <p key={h.id} className="border-b border-border/30 py-2 last:border-b-0">{new Date(h.created_at).toLocaleString("ru-RU")} · {h.action} · target:{h.target_id} · {h.meta?.after_role ?? "—"}</p>
                ))
              ) : <EmptyNote text="История ролей пуста" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "risk" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Risk Center</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Input className="w-[220px]" placeholder="поиск user/id" value={riskQuery} onChange={(e) => setRiskQuery(e.target.value)} />
                <Button size="sm" variant="secondary" onClick={() => runBulkRiskAction("limit_messaging")} disabled={!riskSelected.length || !canManageRisk}>Bulk limit (max 10)</Button>
                <Button size="sm" variant="secondary" onClick={() => runBulkRiskAction("shadowban")} disabled={!riskSelected.length || !canManageRisk}>Bulk shadowban</Button>
                <Button size="sm" variant="danger" onClick={() => runBulkRiskAction("block")} disabled={!riskSelected.length || !canManageRisk}>Bulk block</Button>
                <Button size="sm" variant="secondary" onClick={() => runBulkRiskAction("mark_safe")} disabled={!riskSelected.length || !canManageRisk}>Mark safe</Button>
              </div>

              {(risk.data?.items ?? []).length ? (
                risk.data.items.map((r: any) => (
                  <div key={r.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface2/70 p-3 md:grid-cols-[auto_1fr_auto]">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={riskSelected.includes(r.id)} onChange={(e) => setRiskSelected((prev) => {
                        if (e.target.checked) return [...prev, r.id].slice(0, 10);
                        return prev.filter((x) => x !== r.id);
                      })} />
                      <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                    </label>
                    <div>
                      <p className="font-medium">score: {r.risk_score}</p>
                      <p className="text-xs text-muted">{(r.signals ?? []).join(", ") || "—"}</p>
                      <p className="text-xs text-muted">violations_7d: {r.violations_7d ?? 0} · last_seen: {r.last_seen_at ? new Date(r.last_seen_at).toLocaleString("ru-RU") : "—"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => window.location.href = `/admin/users/${r.id}`}>history</Button>
                      <Button size="sm" variant="secondary" disabled={!canManageRisk} onClick={() => runUserAction(r.id, "limit_messaging")}>limit</Button>
                      <Button size="sm" variant="secondary" disabled={!canManageRisk} onClick={() => runUserAction(r.id, "shadowban")}>shadow</Button>
                      <Button size="sm" variant="danger" disabled={!canManageRisk} onClick={() => runUserAction(r.id, "block")}>block</Button>
                    </div>
                  </div>
                ))
              ) : <EmptyNote text="Risk signals не найдены" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "reports" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Reports Inbox</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(reports.data?.items ?? []).length ? (
                reports.data.items.map((r: any) => (
                  <div key={r.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface2/70 p-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-medium">{r.content_type} · {r.reason}</p>
                      <p className="text-xs text-muted">status:{r.status} · created:{new Date(r.created_at).toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => updateReportStatus(r.id, "in_review")}>In review</Button>
                      <Button size="sm" variant="secondary" onClick={() => updateReportStatus(r.id, "resolved")}>Resolve</Button>
                    </div>
                  </div>
                ))
              ) : <EmptyNote text="Жалоб нет" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "moderation" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Moderation Queue · Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Open reports: {(reports.data?.items ?? []).filter((x: any) => x.status === "open").length}</p>
              <p>In review: {(reports.data?.items ?? []).filter((x: any) => x.status === "in_review").length}</p>
              <p>Resolved: {(reports.data?.items ?? []).filter((x: any) => x.status === "resolved").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Moderation Queue · Risk</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>High risk users: {(risk.data?.items ?? []).filter((x: any) => Number(x.risk_score ?? 0) >= 70).length}</p>
              <p>Medium risk users: {(risk.data?.items ?? []).filter((x: any) => Number(x.risk_score ?? 0) >= 40 && Number(x.risk_score ?? 0) < 70).length}</p>
              <Button variant="secondary" onClick={() => setSection("risk")}>Open Risk Center</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "alerts" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(alerts.data?.items ?? []).length ? (
                alerts.data.items.map((a: any) => (
                  <div key={a.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface2/70 p-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-medium">{a.type} · {a.metric}</p>
                      <p className="text-xs text-muted">status:{a.status} · threshold:{a.threshold} · window:{a.window}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => updateAlertStatus(a, "active")}>Active</Button>
                      <Button size="sm" variant="secondary" onClick={() => updateAlertStatus(a, "paused")}>Paused</Button>
                    </div>
                  </div>
                ))
              ) : <EmptyNote text="Alerts не настроены" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "flags" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Feature Flags</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(flags.data?.flags ?? []).length ? (
                flags.data.flags.map((f: any) => (
                  <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-surface2/70 p-3">
                    <div>
                      <p className="font-medium">{f.key}</p>
                      <p className="text-xs text-muted">enabled:{String(f.enabled)} · rollout:{f.rollout}% · scope:{f.scope}</p>
                    </div>
                    <Button size="sm" onClick={() => toggleFlag(f)}>{f.enabled ? "Disable" : "Enable"}</Button>
                  </div>
                ))
              ) : <EmptyNote text="Feature flags не найдены" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "experiments" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>A/B Experiments</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(experiments.data?.items ?? []).length ? (
                experiments.data.items.map((e: any) => (
                  <div key={e.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                    <p className="font-medium">{e.key}</p>
                    <p className="text-xs text-muted">status:{e.status} · rollout:{e.rollout_percent}% · metric:{e.primary_metric ?? "—"}</p>
                  </div>
                ))
              ) : <EmptyNote text="Экспериментов пока нет" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "assistant" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>AI Admin Assistant</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Textarea rows={4} value={assistantQuestion} onChange={(e) => setAssistantQuestion(e.target.value)} />
              <Button onClick={askAssistant} disabled={assistantLoading}>
                {assistantLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}Ask AI
              </Button>
              {assistantAnswer ? (
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="font-medium">{assistantAnswer.summary ?? "—"}</p>
                  {(assistantAnswer.risks ?? []).length ? <p className="mt-2 text-xs text-muted">Risks: {(assistantAnswer.risks ?? []).join("; ")}</p> : null}
                  {(assistantAnswer.actions ?? []).length ? <p className="mt-2 text-xs text-muted">Actions: {(assistantAnswer.actions ?? []).join("; ")}</p> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "system" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>System Settings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(settings.data?.items ?? []).length ? (
                settings.data.items.map((s: any) => (
                  <div key={s.key} className="rounded-xl border border-border bg-surface2/70 p-3">
                    <p className="font-medium">{s.key}</p>
                    <p className="mt-1 text-xs text-muted break-all">{JSON.stringify(s.value)}</p>
                  </div>
                ))
              ) : <EmptyNote text="Системные настройки не найдены" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "integrations" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(integrations.data?.items ?? []).length ? (
                integrations.data.items.map((i: any) => (
                  <div key={i.key} className="rounded-xl border border-border bg-surface2/70 p-3">
                    <p className="font-medium">{i.key}</p>
                    <p className="text-xs text-muted">status:{i.status} · configured:{String(i.configured)} · errors7d:{i.errors7d ?? 0}</p>
                  </div>
                ))
              ) : <EmptyNote text="Интеграции не найдены" />}
              <p className="text-xs text-muted">API errors 7d: {integrations.data?.apiErrors7d ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "security" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle className="inline-flex items-center gap-2">Security Center {helpMode ? <HelpTip compact {...(helpTexts["section.security"] ?? DEFAULT_HELP_TEXTS["section.security"])} /> : null}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Rate limiting: {String(security.data?.apiProtection?.rateLimitingEnabled ?? false)}</p>
              <p>Zod validation coverage: {String(security.data?.apiProtection?.zodValidationCoverage ?? false)}</p>
              <p>Server-only secrets: {String(security.data?.apiProtection?.serverOnlySecrets ?? false)}</p>
              <p>PII masked in UI: {String(security.data?.dataSecurity?.piiMaskedInUi ?? true)}</p>
              <p>RLS enabled (assumed): {String(security.data?.dataSecurity?.rlsEnabledAssumed ?? true)}</p>
              <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">
                <p className="font-medium text-text">Baseline безопасности</p>
                <p>• RBAC включен и роли ограничены по принципу least privilege.</p>
                <p>• Admin API работает только server-side с service role.</p>
                <p>• Rate limits и anti-spam thresholds не ниже safe range.</p>
                <p>• Аудит действий обязателен для block/limit/config/export.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p className="font-medium">Incident runbook</p>
                <p className="text-xs text-muted">1) DDOS: усилить rate limits, отключить тяжёлые endpoints.</p>
                <p className="text-xs text-muted">2) TG verify падение: проверить webhook и TELEGRAM_BOT_TOKEN.</p>
                <p className="text-xs text-muted">3) Spike reports: переключить safe mode, усилить spam thresholds.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Threat Monitoring</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(security.data?.threatMonitoring?.triggers ?? []).length ? (
                security.data.threatMonitoring.triggers.map((t: any) => (
                  <p key={t.key} className="rounded-xl border border-warning/40 bg-warning/10 p-2">{t.level}: {t.message}</p>
                ))
              ) : <EmptyNote text="Активных триггеров нет" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "backup" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Backup / Restore</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Последний backup: {security.data?.auditLog?.[0]?.created_at ? new Date(security.data.auditLog[0].created_at).toLocaleString("ru-RU") : "N/A"}</p>
              <p>Disaster checklist:</p>
              <p className="text-muted">1. Экспортируй users/reports/events CSV</p>
              <p className="text-muted">2. Зафиксируй incident note в audit</p>
              <p className="text-muted">3. Включи safe mode и ограничь connect/message rate</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => downloadCSV("users")}><Download className="mr-1 h-4 w-4" />Export users</Button>
                <Button variant="secondary" onClick={() => downloadCSV("reports")}><Download className="mr-1 h-4 w-4" />Export reports</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {viewReady && section === "campaigns" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Campaigns (read-only)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Режим: Read-only / подготовка к запуску.</p>
              <p>Активные пользователи 7d: {summaryData?.kpis?.active_users_7d ?? 0}</p>
              <p>Connect reply rate 30d: {formatKpi("reply_rate", Number(summaryData?.kpis?.reply_rate ?? 0))}</p>
              <p>Top city 30d: {summaryData?.tables?.cities_30d?.[0]?.city ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <SectionGuideSheet
        section={section}
        role={access.data?.role ?? null}
        open={helpSheetOpen}
        onOpenChange={setHelpSheetOpen}
      />

      <KpiDrilldownDrawer
        open={Boolean(drillMetric)}
        metric={drillMetric}
        loading={drilldown.isLoading}
        data={drilldown.data ?? null}
        error={drilldown.error ? parseError(drilldown.error) : null}
        onClose={() => setDrillMetric(null)}
        onOpenEvents={openEventsFromDrilldown}
        onCreateAlert={createAlertFromDrilldown}
        onCreateExperiment={createExperimentFromDrilldown}
        onAutoMap={autoMapMetricFromDrilldown}
        autoMapLoading={drilldownAutoMapLoading}
        experimentLoading={drilldownExperimentLoading}
      />
    </AdminShell>
  );
}
