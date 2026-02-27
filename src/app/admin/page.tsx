"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Beaker,
  Bot,
  Download,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { AdminShell, type AdminSection } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/admin-client";
import {
  aiInsightsResponseSchema,
  diagnosticsResponseSchema,
  featureFlagsResponseSchema,
  funnelsResponseSchema,
  moderationQueueResponseSchema,
  overviewResponseSchema,
  retentionResponseSchema,
  userSearchResponseSchema,
} from "@/lib/admin-schemas";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  wmc: "Еженедельные содержательные диалоги (WMC)",
  matchesStarted: "Матчи начаты (Matches Started)",
  continuedD1: "Диалоги D+1 (Continued D+1)",
  offlineConversion: "Оффлайн-конверсия (Offline Conversion)",
  usersTotal: "Пользователи (Users)",
  dau: "Дневная аудитория (DAU)",
  wau: "Недельная аудитория (WAU)",
  mau: "Месячная аудитория (MAU)",
  dauMau: "Липкость (DAU/MAU)",
  newUsers1d: "Новые за день (New Users 1d)",
  newUsers7d: "Новые за 7 дней (New Users 7d)",
  telegramVerifiedRate: "Верификация Telegram (TG Verify Rate)",
  registrationCompletedRate: "Завершение регистрации (Registration Rate)",
  profileCompletionRate: "Заполнение профиля (Profile Completion)",
  verifiedUsers: "Верифицированные (Verified)",
  dailyDuo7d: "Duo за 7 дней",
  videoPosts7d: "Видео за 7 дней",
  eventJoin7d: "Вступления в ивенты 7д",
  connectClicked: "Connect отправлено",
  chatsStarted: "Connect replied / chats",
  reportsOpen: "Жалобы (Reports)",
  flagsOpen: "Флаги (Flags)",
  blockedUsers: "Заблокированные",
  apiErrors1d: "Ошибки API 1д",
  aiCalls7d: "AI вызовы 7д",
  aiCostUsd7d: "Затраты AI 7д ($)",
};

const funnelTitleMap: Record<string, string> = {
  register_started: "register_started",
  telegram_verified: "telegram_verified",
  registration_completed: "registration_completed",
  profile_completed: "profile_completed",
  first_post: "first_post",
  connect_replied: "connect_replied",
};

const metricsTabLabels: Record<"growth" | "activation" | "engagement" | "content" | "events" | "social" | "safety" | "ai" | "health", string> = {
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

function formatDelta(v?: number) {
  if (v === undefined) return null;
  const pct = Math.round(v * 100);
  const positive = pct >= 0;
  return <span className={`text-xs ${positive ? "text-action" : "text-danger"}`}>{positive ? "+" : ""}{pct}% vs prev</span>;
}

function EmptyState({ title, onSeed, onCheck }: { title: string; onSeed: () => void; onCheck: () => void }) {
  return (
    <div className="admin-empty">
      <p className="font-medium text-text">{title}</p>
      <p className="mt-1 text-xs text-muted">Нет данных за период. Проверьте трекинг событий или сгенерируйте демо-данные.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onCheck}><RefreshCw className="mr-1 h-3.5 w-3.5" />Проверить трекинг</Button>
        <Button size="sm" onClick={onSeed}><Plus className="mr-1 h-3.5 w-3.5" />Seed demo data</Button>
      </div>
    </div>
  );
}

function formatMetricValue(name: string, value: number) {
  const lower = name.toLowerCase();
  const isRate = /rate|completion|conversion|stickiness|липкость|доля/.test(lower);
  const isMoney = /cost|usd|\$|стоим/.test(lower);
  if (!Number.isFinite(value)) return "0";
  if (isRate) return `${(value * 100).toFixed(1)}%`;
  if (isMoney) return `$${value.toFixed(3)}`;
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("ru-RU");
  if (Number.isInteger(value)) return value.toLocaleString("ru-RU");
  return value.toFixed(2);
}

function TrendChart({ title, points }: { title: string; points: Array<{ date: string; value: number }> }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const sum = points.reduce((acc, p) => acc + p.value, 0);
  const avg = points.length ? sum / points.length : 0;
  const last = points[points.length - 1]?.value ?? 0;

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface2/70 p-2 text-sm">
          <div>
            <p className="text-xs text-muted">Сумма</p>
            <p className="font-semibold">{Math.round(sum).toLocaleString("ru-RU")}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Среднее/день</p>
            <p className="font-semibold">{avg.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Последняя точка</p>
            <p className="font-semibold">{last.toLocaleString("ru-RU")}</p>
          </div>
        </div>

        {!points.length ? (
          <div className="text-sm text-muted">Нет точек</div>
        ) : (
          <div className="grid h-28 grid-cols-12 items-end gap-1">
            {points.slice(-24).map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1">
                <div className="w-2 rounded-t bg-cyan/70" style={{ height: `${Math.max(4, (p.value / max) * 84)}px` }} />
              </div>
            ))}
          </div>
        )}

        {points.length ? (
          <div className="max-h-32 overflow-auto rounded-xl border border-border bg-surface2/70 p-2">
            {points.slice(-8).map((p) => (
              <div key={p.date} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/40 py-1 text-sm last:border-b-0">
                <span>{p.date}</span>
                <span className="font-semibold">{p.value.toLocaleString("ru-RU")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ActionUiState = {
  loading?: boolean;
  success?: boolean;
  error?: string | null;
  label?: string;
};

function UpdatedBadge({ show, text = "Updated" }: { show?: boolean; text?: string }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className="inline-flex items-center rounded-full border border-action/50 bg-action/10 px-2 py-0.5 text-[10px] font-semibold text-action"
        >
          {text}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded-xl border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{message}</div>;
}

function ActionButton({
  state,
  idleLabel,
  loadingLabel,
  successLabel,
  disabledReason,
  className,
  onClick,
  variant = "default",
  size = "sm",
}: {
  state?: ActionUiState;
  idleLabel: React.ReactNode;
  loadingLabel?: string;
  successLabel?: string;
  disabledReason?: string;
  className?: string;
  onClick: () => void;
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.12 }} className={className}>
      <Button
        size={size}
        variant={variant}
        onClick={onClick}
        disabled={Boolean(state?.loading) || Boolean(disabledReason)}
        title={disabledReason}
      >
        {state?.loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
        {state?.loading ? loadingLabel ?? "Applying..." : idleLabel}
      </Button>
      <div className="mt-1 min-h-[16px]">
        <UpdatedBadge show={Boolean(state?.success)} text={successLabel} />
      </div>
    </motion.div>
  );
}


export default function AdminPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AdminSection>("overview");
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [segment, setSegment] = useState<"all" | "verified" | "new" | "active">("all");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLog, setAiLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [aiDebugMode, setAiDebugMode] = useState(false);
  const [aiDebugPayload, setAiDebugPayload] = useState<Record<string, unknown> | null>(null);
  const [aiActions, setAiActions] = useState<Array<{ id: string; type: "create_alert" | "create_experiment" | "update_flag"; label: string; payload: Record<string, unknown> }>>([]);
  const [appliedAiActions, setAppliedAiActions] = useState<Record<string, boolean>>({});
  const [aiError, setAiError] = useState<string | null>(null);
  const [moderationReason, setModerationReason] = useState("Нарушение правил платформы");
  const [isSeedLoading, setSeedLoading] = useState(false);
  const [alertsForm, setAlertsForm] = useState({ metric: "tg_verify_rate", type: "drop", threshold: 0.2, window_days: 7 });
  const [expForm, setExpForm] = useState({ key: "", rollout_percent: 20, status: "draft", primary_metric: "WMC" });
  const [configForm, setConfigForm] = useState({ key: "feed_lock_days", value: '{"value":7}', description: "" });
  const [metricsTab, setMetricsTab] = useState<"growth" | "activation" | "engagement" | "content" | "events" | "social" | "safety" | "ai" | "health">("growth");
  const [simConfig, setSimConfig] = useState({ users: 300, days: 30, scenario: "normal" as "normal" | "spike" | "drop", intervalSec: 8, eventsPerTick: 25 });
  const [liveConfig, setLiveConfig] = useState({ users_count: 40, interval_sec: 8, mode: "normal" as "normal" | "chaos", intensity: "normal" as "low" | "normal" | "high", events_per_tick: 80 });
  const [showDiagnosticsJson, setShowDiagnosticsJson] = useState(false);
  const [isLiveBusy, setLiveBusy] = useState(false);
  const [actionUi, setActionUi] = useState<Record<string, ActionUiState>>({});
  const [updatedRows, setUpdatedRows] = useState<Record<string, number>>({});
  const [liveBurst, setLiveBurst] = useState<number>(0);
  const liveTotalRef = useRef(0);

  const toISO = new Date().toISOString();
  const fromISO = useMemo(() => {
    const days = Number(dateRange.replace("d", ""));
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [dateRange]);

  const overview = useQuery({
    queryKey: ["admin-overview-v5", fromISO, toISO, segment],
    queryFn: () => adminApi(`/api/admin/metrics/overview?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`, overviewResponseSchema),
  });

  const funnels = useQuery({
    queryKey: ["admin-funnels-v5", fromISO, toISO, segment],
    queryFn: () => adminApi(`/api/admin/metrics/funnels?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`, funnelsResponseSchema),
  });

  const retention = useQuery({
    queryKey: ["admin-retention-v5", segment],
    queryFn: () => adminApi(`/api/admin/metrics/retention?from=${encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())}&to=${encodeURIComponent(toISO)}&segment=${segment}`, retentionResponseSchema),
  });

  const users = useQuery({
    queryKey: ["admin-users-v5", userSearch],
    queryFn: () => adminApi(`/api/admin/users/search?q=${encodeURIComponent(userSearch)}&limit=50`, userSearchResponseSchema),
  });

  const moderation = useQuery({
    queryKey: ["admin-moderation-v5"],
    queryFn: () => adminApi("/api/admin/moderation/actions", moderationQueueResponseSchema),
  });

  const flags = useQuery({
    queryKey: ["admin-flags-v5"],
    queryFn: () => adminApi("/api/admin/feature-flags", featureFlagsResponseSchema),
  });

  const experiments = useQuery({ queryKey: ["admin-experiments-v3"], queryFn: () => api<{ items: any[] }>("/api/admin/experiments") });
  const alerts = useQuery({ queryKey: ["admin-alerts-v3"], queryFn: () => api<{ items: any[] }>("/api/admin/alerts") });
  const risk = useQuery({ queryKey: ["admin-risk-v3"], queryFn: () => api<any>("/api/admin/risk") });
  const reports = useQuery({ queryKey: ["admin-reports-v3"], queryFn: () => api<{ items: any[] }>("/api/admin/reports") });
  const integrations = useQuery({ queryKey: ["admin-integrations"], queryFn: () => api<{ items: any[]; apiErrors7d: number }>("/api/admin/integrations/status") });
  const security = useQuery({ queryKey: ["admin-security"], queryFn: () => api<any>("/api/admin/security/overview") });
  const system = useQuery({ queryKey: ["admin-system"], queryFn: () => api<{ items: any[] }>("/api/admin/system/settings") });

  const metricsLab = useQuery({
    queryKey: ["admin-metrics-lab", metricsTab, fromISO, toISO, segment],
    queryFn: () => api<{ kind: string; kpis: Array<{ name: string; value: number; subtitle?: string | null }>; trends: Array<{ key: string; points: Array<{ date: string; value: number }> }>; top: any[] }>(`/api/admin/metrics/${metricsTab}?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`),
  });

  const seriesMetric = metricsTab === "growth" ? "new_users" : metricsTab === "social" ? "connect_replied" : metricsTab === "health" ? "events" : metricsTab === "ai" ? "ai_cost" : metricsTab === "engagement" ? "dau" : "posts";

  const metricsSeries = useQuery({
    queryKey: ["admin-metrics-series", seriesMetric, fromISO, toISO, segment],
    queryFn: () => api<{ metric: string; points: Array<{ ts: string; value: number }> }>(`/api/admin/metrics/series?metric=${encodeURIComponent(seriesMetric)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}&group_by=day`),
  });

  const topUsersMetric = metricsTab === "social" ? "connect_sent" : metricsTab === "events" ? "event_joined" : metricsTab === "safety" ? "reports_received" : "post_published_daily_duo";
  const topUsersMetrics = useQuery({
    queryKey: ["admin-top-users", topUsersMetric, fromISO, toISO],
    queryFn: () => api<{ metric: string; items: Array<{ user_id: string; name: string; city: string | null; value: number }> }>(`/api/admin/metrics/top/users?metric=${encodeURIComponent(topUsersMetric)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&limit=10`),
  });

  const topEventsMetric = metricsTab === "events" ? "joins" : "views";
  const topEventsMetrics = useQuery({
    queryKey: ["admin-top-events", topEventsMetric, fromISO, toISO],
    queryFn: () => api<{ metric: string; items: Array<{ event_id: string; title: string; value: number; location: string | null }> }>(`/api/admin/metrics/top/events?metric=${encodeURIComponent(topEventsMetric)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&limit=10`),
  });

  const diagnostics = useQuery({
    queryKey: ["admin-diagnostics-v2"],
    queryFn: () => adminApi("/api/admin/diagnostics", diagnosticsResponseSchema),
    refetchInterval: 15000,
    retry: false,
  });

  const liveSim = useQuery({
    queryKey: ["admin-live-sim-v2"],
    queryFn: () => api<{ devtools: { enabled: boolean; reason: string }; running: boolean; run: any | null; events_per_minute: number; events_24h: number; cron_warning: string | null }>("/api/admin/sim/state"),
    refetchInterval: 5000,
  });

  const refetchLiveSim = liveSim.refetch;
  const refetchOverview = overview.refetch;
  const refetchMetricsLab = metricsLab.refetch;

  function setActionLoading(key: string) {
    setActionUi((prev) => ({ ...prev, [key]: { loading: true, success: false, error: null } }));
  }

  function setActionSuccess(key: string, label = "Updated") {
    setActionUi((prev) => ({ ...prev, [key]: { loading: false, success: true, error: null, label } }));
    window.setTimeout(() => {
      setActionUi((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), success: false, error: null } }));
    }, 2500);
  }

  function setActionError(key: string, message: string) {
    setActionUi((prev) => ({ ...prev, [key]: { loading: false, success: false, error: message } }));
  }

  function pulseRow(id: string) {
    const expireAt = Date.now() + 2400;
    setUpdatedRows((prev) => ({ ...prev, [id]: expireAt }));
    window.setTimeout(() => {
      setUpdatedRows((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 2600);
  }

  async function seedDemo() {
    try {
      setActionLoading("seedDemo");
      setSeedLoading(true);
      const res = await api<{ insertedEvents: number }>("/api/admin/dev/seed-analytics", { method: "POST", body: JSON.stringify(simConfig) });
      await Promise.all([
        overview.refetch(),
        funnels.refetch(),
        retention.refetch(),
        users.refetch(),
        diagnostics.refetch(),
      ]);
      setActionSuccess("seedDemo", "+" + res.insertedEvents + " events");
    } catch (e) {
      setActionError("seedDemo", e instanceof Error ? e.message : "Ошибка seed");
    } finally {
      setSeedLoading(false);
    }
  }

  async function checkTracking() {
    try {
      setActionLoading("checkTracking");
      await api("/api/admin/health/test-event", { method: "POST" });
      const res = await api<{ triggered: any[]; dataMissingEvents24h: string[] }>("/api/admin/alerts/check", { method: "POST" });
      await Promise.all([alerts.refetch(), diagnostics.refetch()]);
      if (res.dataMissingEvents24h.length) {
        setActionError("checkTracking", "Нет данных 24ч: " + res.dataMissingEvents24h.join(", "));
      } else {
        setActionSuccess("checkTracking", "Tracking OK");
      }
    } catch (e) {
      setActionError("checkTracking", e instanceof Error ? e.message : "Ошибка проверки");
    }
  }

  async function runDiagnostics() {
    setActionLoading("diagnostics");
    const res = await diagnostics.refetch();
    if (res.error) {
      setActionError("diagnostics", res.error instanceof Error ? res.error.message : "Ошибка диагностики");
      return;
    }
    const issuesCount = res.data?.issues.length ?? 0;
    if (issuesCount > 0) {
      setActionError("diagnostics", "Проблем: " + issuesCount);
      return;
    }
    setActionSuccess("diagnostics", "Diagnostics OK");
  }

  async function fixCommonIssues(action: string = "run_all") {
    try {
      const actionKey = action === "run_all" ? "fixCommon" : "autofix-" + action;
      setActionLoading(actionKey);
      const res = await api<{ actions: string[]; note?: string }>("/api/admin/fix-common", { method: "POST", body: JSON.stringify({ action }) });
      await Promise.all([overview.refetch(), funnels.refetch(), retention.refetch(), diagnostics.refetch(), liveSim.refetch(), metricsLab.refetch(), users.refetch(), risk.refetch(), reports.refetch()]);
      const label = res.note ? res.note : "Applied: " + (res.actions?.length ?? 0);
      setActionSuccess(actionKey, label);
      if (action !== "run_all") setActionSuccess("fixCommon", "Updated");
    } catch (e) {
      const actionKey = action === "run_all" ? "fixCommon" : "autofix-" + action;
      setActionError(actionKey, e instanceof Error ? e.message : "Fix failed");
      if (action !== "run_all") setActionError("fixCommon", e instanceof Error ? e.message : "Fix failed");
    }
  }

  async function seedMinimal() {
    try {
      setActionLoading("seedMinimal");
      const res = await api<{ users: number; events: number }>("/api/admin/dev/seed-minimal", { method: "POST" });
      await Promise.all([overview.refetch(), funnels.refetch(), retention.refetch(), diagnostics.refetch(), liveSim.refetch(), metricsLab.refetch(), users.refetch()]);
      setActionSuccess("seedMinimal", "users " + res.users + " · events " + res.events);
    } catch (e) {
      setActionError("seedMinimal", e instanceof Error ? e.message : "Seed minimal failed");
    }
  }

  async function startLive(config?: Partial<typeof liveConfig>) {
    const confirmed = window.confirm("Запустить Live Simulation и записывать демо-события в базу?");
    if (!confirmed) return;
    try {
      setActionLoading("startLive");
      setLiveBusy(true);
      const payload = { ...liveConfig, ...config };
      await api("/api/admin/sim/start", { method: "POST", body: JSON.stringify(payload) });
      await Promise.all([liveSim.refetch(), diagnostics.refetch(), overview.refetch()]);
      setActionSuccess("startLive", "Running");
    } catch (e) {
      setActionError("startLive", e instanceof Error ? e.message : "Live start failed");
    } finally {
      setLiveBusy(false);
    }
  }

  async function stopLive() {
    try {
      setActionLoading("stopLive");
      setLiveBusy(true);
      await api("/api/admin/sim/stop", { method: "POST", body: JSON.stringify({ run_id: liveSim.data?.run?.id ?? null }) });
      await Promise.all([liveSim.refetch(), diagnostics.refetch(), overview.refetch()]);
      setActionSuccess("stopLive", "Stopped");
    } catch (e) {
      setActionError("stopLive", e instanceof Error ? e.message : "Live stop failed");
    } finally {
      setLiveBusy(false);
    }
  }

  async function tickLive() {
    try {
      setActionLoading("tickLive");
      const res = await api<{ events_written: number }>("/api/admin/sim/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: liveSim.data?.run?.id ?? undefined, events_per_tick: liveConfig.events_per_tick }),
      });
      setLiveBurst(res.events_written);
      window.setTimeout(() => setLiveBurst(0), 1000);
      await Promise.all([liveSim.refetch(), overview.refetch(), funnels.refetch(), metricsLab.refetch(), users.refetch()]);
      setActionSuccess("tickLive", "+" + res.events_written);
    } catch (e) {
      setActionError("tickLive", e instanceof Error ? e.message : "Tick failed");
    }
  }

  async function moderate(action: any) {
    try {
      const actionKey = "moderate-" + action.targetId;
      setActionLoading(actionKey);
      await api("/api/admin/moderation/actions", { method: "POST", body: JSON.stringify({ ...action, reason: moderationReason }) });

      if (action.targetType === "user") {
        queryClient.setQueryData<any>(["admin-users-v5", userSearch], (prev) => {
          if (!prev?.items) return prev;
          return {
            ...prev,
            items: prev.items.map((u: any) => {
              if (u.id !== action.targetId) return u;
              if (action.action === "shadowban") return { ...u, shadow_banned: true };
              if (action.action === "block_user") return { ...u, is_blocked: true };
              if (action.action === "unblock_user") return { ...u, is_blocked: false };
              if (action.action === "mark_safe") return { ...u, is_blocked: false, shadow_banned: false, message_limited: false };
              return u;
            }),
          };
        });

        queryClient.setQueryData<any>(["admin-risk-v3"], (prev) => {
          if (!prev?.items) return prev;
          return {
            ...prev,
            items: prev.items.map((r: any) => {
              if (r.id !== action.targetId) return r;
              if (action.action === "mark_safe") return { ...r, risk_status: "low", risk_score: 0, signals: [] };
              if (action.action === "block_user") return { ...r, risk_status: "high", risk_score: Math.max(90, r.risk_score ?? 0) };
              if (action.action === "shadowban") return { ...r, risk_status: "medium", risk_score: Math.max(60, r.risk_score ?? 0) };
              return r;
            }),
          };
        });
      }

      pulseRow(action.targetId);
      setActionSuccess(actionKey, "Updated");
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-v5"] });
      queryClient.invalidateQueries({ queryKey: ["admin-risk-v3"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports-v3"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-v5"] });
      queryClient.invalidateQueries({ queryKey: ["admin-security"] });
    } catch (e) {
      setActionError("moderate-" + action.targetId, e instanceof Error ? e.message : "Ошибка модерации");
    }
  }

  async function askAI() {
    if (aiQuestion.trim().length < 3) return;
    const q = aiQuestion.trim();
    setAiQuestion("");
    setAiError(null);
    setAiLog((prev) => [...prev, { role: "user", text: q }]);
    setActionLoading("askAI");

    try {
      const res = await adminApi("/api/admin/ai/insights", aiInsightsResponseSchema, {
        method: "POST",
        body: JSON.stringify({
          question: q,
          debug: aiDebugMode,
          context: {
            overview: overview.data?.overview,
            comparisons: overview.data?.comparisons,
            funnels: funnels.data?.steps,
            alerts: alerts.data?.items,
            experiments: experiments.data?.items,
            configs: flags.data?.configs,
          },
        }),
      });

      const answer = [
        res.summary,
        "Ключевые выводы: " + res.key_findings.join(" | "),
        "Доказательства: " + res.evidence.join(" | "),
        "Рекомендованные действия: " + res.recommended_actions.join(" | "),
      ].join("\n\n");

      setAiActions(res.actions ?? []);
      setAppliedAiActions({});
      setAiDebugPayload((res.debug as Record<string, unknown> | undefined) ?? null);
      setAiLog((prev) => [...prev, { role: "assistant", text: answer }]);
      setSection("assistant");
      setActionSuccess("askAI", "Answered");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка AI";
      setAiError(message);
      setActionError("askAI", message);
    }
  }

  async function applyAiAction(action: { id: string; type: "create_alert" | "create_experiment" | "update_flag"; label: string; payload: Record<string, unknown> }) {
    const actionKey = "applyAi-" + action.id;
    try {
      setActionLoading(actionKey);
      if (action.type === "create_alert") {
        await api("/api/admin/alerts", {
          method: "POST",
          body: JSON.stringify({
            type: String(action.payload.type ?? "drop"),
            metric: String(action.payload.metric ?? "tg_verify_rate"),
            threshold: Number(action.payload.threshold ?? 0.2),
            window_days: Number(action.payload.window_days ?? 7),
            status: String(action.payload.status ?? "active"),
          }),
        });
        setSection("alerts");
      }

      if (action.type === "create_experiment") {
        const status = String(action.payload.status ?? "draft");
        await api("/api/admin/experiments", {
          method: "POST",
          body: JSON.stringify({
            key: String(action.payload.key ?? ("ai_experiment_" + Date.now())),
            variants: (action.payload.variants as Record<string, unknown>) ?? { A: "control", B: "variant" },
            rollout_percent: Number(action.payload.rollout_percent ?? 20),
            status: ["draft", "running", "paused", "completed"].includes(status) ? status : "draft",
            primary_metric: String(action.payload.primary_metric ?? "WMC"),
            start_at: null,
            end_at: null,
          }),
        });
        setSection("experiments");
      }

      if (action.type === "update_flag") {
        await api("/api/admin/feature-flags", {
          method: "POST",
          body: JSON.stringify({
            key: String(action.payload.key ?? "feed_lock_days"),
            description: String(action.payload.description ?? "AI suggestion"),
            enabled: Boolean(action.payload.enabled ?? true),
            rollout: Number(action.payload.rollout ?? 100),
            scope: String(action.payload.scope ?? "global"),
            payload: (action.payload.payload as Record<string, unknown>) ?? { value: 7 },
          }),
        });
        setSection("flags");
      }

      setAppliedAiActions((prev) => ({ ...prev, [action.id]: true }));
      await Promise.all([overview.refetch(), alerts.refetch(), experiments.refetch(), flags.refetch()]);
      setActionSuccess(actionKey, "Applied");
    } catch (e) {
      setActionError(actionKey, e instanceof Error ? e.message : "Не удалось применить рекомендацию");
    }
  }

  async function toggleFlag(flag: any) {
    const actionKey = "flag-" + flag.id;
    try {
      setActionLoading(actionKey);
      await api("/api/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify({ ...flag, enabled: !flag.enabled }),
      });
      await flags.refetch();
      setActionSuccess(actionKey, "Updated");
    } catch (e) {
      setActionError(actionKey, e instanceof Error ? e.message : "Не удалось обновить флаг");
    }
  }

  async function createAlert() {
    try {
      setActionLoading("createAlert");
      await api("/api/admin/alerts", { method: "POST", body: JSON.stringify(alertsForm) });
      await alerts.refetch();
      setActionSuccess("createAlert", "Saved");
    } catch (e) {
      setActionError("createAlert", e instanceof Error ? e.message : "Не удалось создать алерт");
    }
  }

  async function createExperiment() {
    if (!expForm.key.trim()) {
      setActionError("createExperiment", "Укажи key");
      return;
    }
    try {
      setActionLoading("createExperiment");
      await api("/api/admin/experiments", {
        method: "POST",
        body: JSON.stringify({ ...expForm, variants: { A: "control", B: "variant" } }),
      });
      await experiments.refetch();
      setActionSuccess("createExperiment", "Saved");
    } catch (e) {
      setActionError("createExperiment", e instanceof Error ? e.message : "Не удалось сохранить эксперимент");
    }
  }

  async function upsertConfig() {
    try {
      setActionLoading("upsertConfig");
      await api("/api/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify({ kind: "config", key: configForm.key, value: JSON.parse(configForm.value), description: configForm.description }),
      });
      await flags.refetch();
      setActionSuccess("upsertConfig", "Saved");
    } catch (e) {
      setActionError("upsertConfig", e instanceof Error ? e.message : "Проверь JSON value");
    }
  }

  async function saveSystemSetting(key: string, value: Record<string, unknown>) {
    const actionKey = "saveSystem-" + key;
    try {
      setActionLoading(actionKey);
      await api("/api/admin/system/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
      await system.refetch();
      setActionSuccess(actionKey, "Saved");
    } catch (e) {
      setActionError(actionKey, e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }

  async function updateReportStatus(id: string, status: "in_review" | "resolved") {
    const actionKey = "report-" + id;
    try {
      setActionLoading(actionKey);
      await api("/api/admin/reports", { method: "PUT", body: JSON.stringify({ id, status }) });
      pulseRow(id);
      await reports.refetch();
      setActionSuccess(actionKey, "Updated");
    } catch (e) {
      setActionError(actionKey, e instanceof Error ? e.message : "Не удалось обновить жалобу");
    }
  }

  function exportCSV(table: string) {
    window.open(`/api/admin/export?table=${encodeURIComponent(table)}`, "_blank");
  }

  useEffect(() => {
    if (!liveSim.data?.running || !liveSim.data?.run?.id) return;
    const interval = Math.max(3000, Number(liveSim.data?.run?.interval_sec ?? 8) * 1000);
    const id = window.setInterval(() => {
      api("/api/admin/sim/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: liveSim.data?.run?.id, events_per_tick: liveConfig.events_per_tick }),
      })
        .then(() => Promise.all([refetchLiveSim(), refetchOverview(), refetchMetricsLab()]))
        .catch(() => undefined);
    }, interval);

    return () => window.clearInterval(id);
  }, [
    liveSim.data?.running,
    liveSim.data?.run?.id,
    liveSim.data?.run?.interval_sec,
    liveConfig.events_per_tick,
    refetchLiveSim,
    refetchOverview,
    refetchMetricsLab,
  ]);

  useEffect(() => {
    const total = Number(liveSim.data?.run?.total_events_generated ?? 0);
    if (total > liveTotalRef.current) {
      const diff = total - liveTotalRef.current;
      if (diff > 0) {
        setLiveBurst(diff);
        window.setTimeout(() => setLiveBurst(0), 1000);
      }
    }
    liveTotalRef.current = total;
  }, [liveSim.data?.run?.total_events_generated]);

  const isRowUpdated = (id: string) => (updatedRows[id] ?? 0) > Date.now();

  const isOverviewLoading = overview.isLoading;
  const noData = !isOverviewLoading && Object.keys(overview.data?.overview ?? {}).length === 0;

  const queryErrors = [
    overview.error,
    funnels.error,
    retention.error,
    users.error,
    moderation.error,
    flags.error,
    alerts.error,
    risk.error,
    reports.error,
    metricsLab.error,
    diagnostics.error,
  ]
    .filter(Boolean)
    .map((error) => (error instanceof Error ? error.message : "Request failed"));

  const checklist = {
    eventsTracked:
      Boolean(diagnostics.data?.last_event_at) &&
      Date.now() - new Date(diagnostics.data?.last_event_at ?? 0).getTime() < 24 * 60 * 60 * 1000,
    metricsReady: !noData,
    simulationEnabled: diagnostics.data?.devtools.enabled ?? false,
    aiConnected: diagnostics.data?.openai.enabled ?? false,
    alertsWorking: (alerts.data?.items?.length ?? 0) > 0 || (overview.data?.health?.integrations.integrationErrors7d ?? 0) >= 0,
  };

  const diagnosticsRlsRows = useMemo(() => {
    const raw = diagnostics.data?.rls;
    if (!raw) return [] as Array<{ table: string; can_select: boolean; note: string }>;
    if (Array.isArray(raw)) return raw;
    return raw.details ?? [];
  }, [diagnostics.data?.rls]);

  const diagnosticsRlsIssues = useMemo(() => {
    const raw = diagnostics.data?.rls;
    if (!raw) return [] as string[];
    if (Array.isArray(raw)) return raw.filter((x) => !x.can_select).map((x) => `${x.table}: ${x.note}`);
    return raw.issues ?? [];
  }, [diagnostics.data?.rls]);

  const diagnosticsRootCause = useMemo(() => {
    const reasons: string[] = [];
    if ((diagnostics.data?.event_counts_24h?.total ?? 0) > 0 && (diagnostics.data?.metrics_endpoints?.sample_points_count ?? 0) === 0) {
      reasons.push("Есть события, но series вернула 0 точек");
    }
    if (diagnostics.data?.metrics_endpoints?.errors) reasons.push("Series endpoint error: " + diagnostics.data.metrics_endpoints.errors);
    if (diagnosticsRlsIssues.length) reasons.push("RLS блокирует чтение части таблиц");
    if ((diagnostics.data?.top_event_names?.length ?? 0) > 0 && (diagnostics.data?.issues ?? []).some((x) => x.toLowerCase().includes("event names mismatch"))) {
      reasons.push("Имена событий не совпадают со словарем метрик");
    }
    if ((diagnostics.data?.event_counts_24h?.total ?? 0) === 0) reasons.push("За 24ч нет событий analytics");
    return reasons;
  }, [diagnostics.data?.event_counts_24h?.total, diagnostics.data?.metrics_endpoints?.sample_points_count, diagnostics.data?.metrics_endpoints?.errors, diagnostics.data?.top_event_names, diagnostics.data?.issues, diagnosticsRlsIssues.length]);

  const normalizedSeriesPoints = useMemo(() => {
    const source = metricsSeries.data?.points ?? [];
    if (source.length) return source;
    const from = new Date(fromISO);
    const to = new Date(toISO);
    from.setUTCHours(0, 0, 0, 0);
    const out: Array<{ ts: string; value: number }> = [];
    while (from <= to) {
      out.push({ ts: from.toISOString().slice(0, 10), value: 0 });
      from.setUTCDate(from.getUTCDate() + 1);
    }
    return out;
  }, [metricsSeries.data?.points, fromISO, toISO]);

  const conversionRows = useMemo(() => {
    const ov = overview.data?.overview;
    if (!ov) return [] as Array<{ label: string; value: number }>;
    const connectReplyRate = ov.connectClicked > 0 ? ov.chatsStarted / ov.connectClicked : 0;
    const contentPosts7d = Number(ov.dailyDuo7d ?? 0) + Number(ov.videoPosts7d ?? 0);
    const eventJoinPerPost = contentPosts7d > 0 ? Number(ov.eventJoin7d ?? 0) / contentPosts7d : 0;

    return [
      { label: "Верификация Telegram", value: Number(ov.telegramVerifiedRate ?? 0) },
      { label: "Завершение регистрации", value: Number(ov.registrationCompletedRate ?? 0) },
      { label: "Заполнение профиля", value: Number(ov.profileCompletionRate ?? 0) },
      { label: "Ответ на connect", value: Number(connectReplyRate) },
      { label: "Join/Post Rate (7д)", value: Number(eventJoinPerPost) },
      { label: "Липкость DAU/MAU", value: Number(ov.dauMau ?? 0) },
    ];
  }, [overview.data?.overview]);

  const funnelRows = useMemo(() => {
    return (funnels.data?.steps ?? []).map((step) => ({
      step: funnelTitleMap[step.step] ?? step.step,
      users: step.count,
      conversion: String(Math.round(step.conversionFromStart * 100)) + "%",
      drop: String(Math.round(step.drop * 100)) + "%",
    }));
  }, [funnels.data?.steps]);

  return (
    <AdminShell
      section={section}
      onSectionChange={setSection}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      segment={segment}
      onSegmentChange={setSegment}
      onAskAI={askAI}
      search={search}
      onSearch={setSearch}
    >
      {queryErrors.length ? (
        <div className="col-span-12">
          <Card className="border-danger/40 bg-danger/10">
            <CardHeader><CardTitle>Проблемы загрузки данных</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {queryErrors.slice(0, 6).map((message, idx) => (
                <p key={idx} className="text-danger">• {message}</p>
              ))}
              <div className="flex flex-wrap gap-2">
                <ActionButton state={actionUi.diagnostics} variant="secondary" idleLabel="Run Diagnostics" loadingLabel="Running..." successLabel={actionUi.diagnostics?.label} onClick={runDiagnostics} />
                <ActionButton state={actionUi.checkTracking} variant="secondary" idleLabel="Проверить трекинг" loadingLabel="Checking..." successLabel={actionUi.checkTracking?.label} onClick={checkTracking} />
                <ActionButton state={actionUi.seedDemo} idleLabel="Seed demo data" loadingLabel="Seeding..." successLabel={actionUi.seedDemo?.label} onClick={seedDemo} />
                <ActionButton state={actionUi.fixCommon} variant="secondary" idleLabel="Fix common issues" loadingLabel="Fixing..." successLabel={actionUi.fixCommon?.label} onClick={fixCommonIssues} />
                <ActionButton state={actionUi.startLive} idleLabel="Start Live 40 Users" loadingLabel="Starting..." successLabel={actionUi.startLive?.label} onClick={() => startLive({ users_count: 40, mode: "normal", intensity: "normal" })} />
              </div>
              <InlineError message={actionUi.diagnostics?.error ?? actionUi.checkTracking?.error ?? actionUi.seedDemo?.error ?? actionUi.fixCommon?.error ?? actionUi.startLive?.error} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "overview" ? (
        <>
          {isOverviewLoading ? (
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="col-span-12 sm:col-span-6 xl:col-span-3"><Skeleton className="h-28 w-full" /></div>)
          ) : noData ? (
            <div className="col-span-12"><EmptyState title="Нет KPI за выбранный период" onSeed={seedDemo} onCheck={checkTracking} /></div>
          ) : (
            Object.entries(overview.data?.overview ?? {}).map(([k, v], idx) => (
              <motion.div key={k} className="col-span-12 sm:col-span-6 xl:col-span-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.01 }}>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted">{labels[k] ?? k}</p>
                    <p className="mt-2 text-2xl font-semibold text-text">
                      {typeof v === "number" ? formatMetricValue(k, v) : String(v)}
                    </p>
                    {k === "registrationCompletedRate" ? formatDelta(overview.data?.comparisons?.registrationDiff) : null}
                    {k === "connectClicked" ? formatDelta(overview.data?.comparisons?.connectDiff) : null}
                    {k === "wmc" ? formatDelta(overview.data?.comparisons?.wmcDiff) : null}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}

          <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <TrendChart title="DAU trend" points={overview.data?.trends?.dau ?? []} />
            <TrendChart title="Posts trend" points={overview.data?.trends?.posts ?? []} />
            <TrendChart title="Connect replied trend" points={overview.data?.trends?.connectReplied ?? []} />
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card>
              <CardHeader><CardTitle>Мини-воронка</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(overview.data?.miniFunnel ?? []).map((step) => (
                  <div key={step.step} className="rounded-xl border border-border bg-surface2/70 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <p>{funnelTitleMap[step.step] ?? step.step}</p>
                      <p>{step.count}</p>
                    </div>
                    <p className="text-xs text-muted">Conversion: {Math.round(step.conversion * 100)}%</p>
                  </div>
                ))}
                {!overview.data?.miniFunnel?.length ? <EmptyState title="Нет данных воронки" onSeed={seedDemo} onCheck={checkTracking} /> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Конверсии приложения</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {conversionRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl border border-border bg-surface2/70 px-3 py-2 text-sm">
                    <span>{row.label}</span>
                    <span className="font-semibold">{formatMetricValue(row.label, row.value)}</span>
                  </div>
                ))}
                {!conversionRows.length ? <p className="text-sm text-muted">Нет данных для расчёта конверсий.</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Health + Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p>p95 latency: <strong>{Math.round(overview.data?.health?.p95Latency ?? 0)} ms</strong></p>
                  <p>Ошибки интеграций 7д: <strong>{overview.data?.health?.integrations.integrationErrors7d ?? 0}</strong></p>
                  <p>TG: {(overview.data?.health?.integrations.telegramConfigured ?? false) ? "OK" : "MISSING"}</p>
                  <p>OpenAI: {(overview.data?.health?.integrations.openAiConfigured ?? false) ? "OK" : "MISSING"}</p>
                  <p>Supabase: {(overview.data?.health?.integrations.supabaseConfigured ?? false) ? "OK" : "MISSING"}</p>
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-1 text-xs text-muted">Последние действия админов</p>
                  {(overview.data?.health?.lastAdminActions ?? []).slice(0, 6).map((a: any) => (
                    <p key={a.id} className="text-xs">• {a.action} · {new Date(a.created_at).toLocaleString("ru-RU")}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Data Health / Diagnostics</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p>Статус: <strong>{(diagnostics.data?.issues.length ?? 0) === 0 ? "OK" : (diagnostics.data?.event_counts_24h?.total ?? 0) > 0 ? "WARNING" : "ERROR"}</strong></p>
                  <p>Supabase: <strong>{!diagnostics.isFetched ? "N/A" : diagnostics.data?.supabase_ok ? "OK" : "ISSUES"}</strong></p>
                  <p>Devtools: <strong>{diagnostics.data?.devtools.enabled ? "ENABLED" : "DISABLED"}</strong> · {diagnostics.data?.devtools.reason ?? "-"}</p>
                  <p>OpenAI: <strong>{diagnostics.data?.openai.enabled ? "ENABLED" : "DISABLED"}</strong> · {diagnostics.data?.openai.reason ?? "-"}</p>
                  <p>Последнее событие: <strong>{diagnostics.data?.last_event_at ? new Date(diagnostics.data.last_event_at).toLocaleString("ru-RU") : diagnostics.isFetched ? "нет" : "запусти диагностику"}</strong></p>
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-xs text-muted">События за 24ч</p>
                  <p className="text-xs">total: {diagnostics.data?.event_counts_24h?.total ?? 0}</p>
                  <p className="text-xs">register_started: {diagnostics.data?.event_counts_24h?.register_started ?? 0}</p>
                  <p className="text-xs">telegram_verified: {diagnostics.data?.event_counts_24h?.telegram_verified ?? 0}</p>
                  <p className="text-xs">registration_completed: {diagnostics.data?.event_counts_24h?.registration_completed ?? 0}</p>
                  <p className="text-xs">posts duo/video: {(diagnostics.data?.event_counts_24h?.posts_duo ?? 0) + (diagnostics.data?.event_counts_24h?.posts_video ?? 0)}</p>
                  <p className="text-xs">connect sent/replied: {(diagnostics.data?.event_counts_24h?.connect_sent ?? 0)}/{diagnostics.data?.event_counts_24h?.connect_replied ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-xs text-muted">Почему графики могут быть пустыми</p>
                  {diagnosticsRootCause.length ? (
                    diagnosticsRootCause.map((reason) => <p key={reason} className="text-xs">• {reason}</p>)
                  ) : (
                    <p className="text-xs text-muted">Критичных причин не найдено.</p>
                  )}
                  <p className="mt-2 text-xs">Series endpoint: <strong>{diagnostics.data?.metrics_endpoints?.series_ok ? "OK" : "ISSUE"}</strong> · points: <strong>{diagnostics.data?.metrics_endpoints?.sample_points_count ?? 0}</strong></p>
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-xs text-muted">Top event names (24h)</p>
                  {(diagnostics.data?.top_event_names ?? []).slice(0, 8).map((item) => (
                    <p key={item.event_name} className="text-xs">• {item.event_name}: {item.count_24h}</p>
                  ))}
                  {!diagnostics.data?.top_event_names?.length ? <p className="text-xs text-muted">Нет событий за 24ч.</p> : null}
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-xs text-muted">Admin Checklist</p>
                  <p className="text-xs">{checklist.eventsTracked ? "✔" : "✖"} события пишутся</p>
                  <p className="text-xs">{checklist.metricsReady ? "✔" : "✖"} метрики считаются</p>
                  <p className="text-xs">{checklist.simulationEnabled ? "✔" : "✖"} симуляция доступна</p>
                  <p className="text-xs">{checklist.aiConnected ? "✔" : "✖"} AI подключен</p>
                  <p className="text-xs">{checklist.alertsWorking ? "✔" : "✖"} alerts работают</p>
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-xs text-muted">Таблицы / rows 24h | 7d | 30d</p>
                  {(diagnostics.data?.tables ?? []).slice(0, 8).map((table) => (
                    <p key={table.name} className="text-xs">• {table.name}: {table.exists ? "ok" : "missing"} · {table.rows_24h}/{table.rows_7d}/{table.rows_30d}</p>
                  ))}
                  {!diagnostics.data?.tables?.length && diagnostics.isFetched ? <p className="text-xs text-muted">Нет результатов диагностики.</p> : null}
                  <p className="mt-2 mb-1 text-xs text-muted">RLS / permissions</p>
                  {diagnosticsRlsRows.slice(0, 6).map((item) => (
                    <p key={item.table} className="text-xs">• {item.table}: {item.can_select ? "can_select" : "blocked"} · {item.note}</p>
                  ))}
                  {!diagnosticsRlsRows.length ? <p className="text-xs text-muted">RLS-данные недоступны.</p> : null}
                </div>

                {(diagnostics.data?.issues.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                    <p className="mb-1 text-xs text-danger">Issues</p>
                    {(diagnostics.data?.issues ?? []).slice(0, 6).map((issue, idx) => <p key={idx} className="text-xs">• {issue}</p>)}
                    <p className="mt-2 mb-1 text-xs text-muted">Fixes</p>
                    {(diagnostics.data?.fixes ?? []).slice(0, 4).map((fix, idx) => <p key={idx} className="text-xs">• {fix}</p>)}
                  </div>
                ) : diagnostics.isFetched ? (
                  <div className="rounded-xl border border-action/30 bg-action/10 p-3">
                    <p className="text-xs text-action">Критичных проблем не найдено.</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <ActionButton state={actionUi.diagnostics} variant="secondary" idleLabel="Run Diagnostics" loadingLabel="Running..." successLabel={actionUi.diagnostics?.label} onClick={runDiagnostics} />
                  <ActionButton state={actionUi.fixCommon} variant="secondary" idleLabel="Fix Common Issues" loadingLabel="Fixing..." successLabel={actionUi.fixCommon?.label} onClick={fixCommonIssues} />
                  <ActionButton state={actionUi.checkTracking} variant="secondary" idleLabel="Check Tracking" loadingLabel="Checking..." successLabel={actionUi.checkTracking?.label} onClick={checkTracking} />
                  <ActionButton state={actionUi.seedMinimal} variant="secondary" idleLabel="Seed Minimal" loadingLabel="Seeding..." successLabel={actionUi.seedMinimal?.label} onClick={seedMinimal} />
                  <ActionButton
                    state={actionUi.startLive}
                    idleLabel="Start Live 40 Users"
                    loadingLabel="Starting..."
                    successLabel={actionUi.startLive?.label}
                    disabledReason={!diagnostics.data?.devtools.enabled ? diagnostics.data?.devtools.reason : undefined}
                    onClick={() => startLive({ users_count: 40, interval_sec: 8, mode: "normal", intensity: "normal" })}
                  />
                  <Button size="sm" variant="secondary" onClick={() => setShowDiagnosticsJson((v) => !v)}>{showDiagnosticsJson ? "Hide JSON" : "Diagnostics JSON"}</Button>
                </div>
                {(diagnostics.data?.recommended_fixes?.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-border bg-surface2/70 p-3">
                    <p className="mb-2 text-xs text-muted">Auto-fix</p>
                    <div className="flex flex-wrap gap-2">
                      {(diagnostics.data?.recommended_fixes ?? []).slice(0, 8).map((fix) => (
                        <ActionButton
                          key={fix.key}
                          state={actionUi[`autofix-${fix.key}`]}
                          size="sm"
                          variant="secondary"
                          idleLabel={fix.title}
                          loadingLabel="Fixing..."
                          successLabel={actionUi[`autofix-${fix.key}`]?.label}
                          onClick={() => fixCommonIssues(fix.key)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <InlineError message={actionUi.diagnostics?.error ?? actionUi.fixCommon?.error ?? actionUi.checkTracking?.error ?? actionUi.seedMinimal?.error ?? actionUi.startLive?.error} />

                {showDiagnosticsJson ? (
                  <div className="rounded-xl border border-border bg-surface2/70 p-3">
                    <pre className="max-h-64 overflow-auto text-[11px] leading-relaxed text-muted">{JSON.stringify(diagnostics.data ?? {}, null, 2)}</pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {section === "funnels" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Воронка продукта</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {funnels.isLoading ? <Skeleton className="h-64 w-full" /> : null}
              <div className="overflow-x-auto rounded-xl border border-border bg-surface2/70 p-2">
                <div className="grid min-w-[680px] grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border/40 px-2 py-2 text-sm font-semibold">
                  <span>Шаг</span>
                  <span className="text-right">Пользователи</span>
                  <span className="text-right">Конверсия</span>
                  <span className="text-right">Drop-off</span>
                </div>
                {funnelRows.map((row) => (
                  <div key={row.step} className="grid min-w-[680px] grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border/30 px-2 py-2 text-sm last:border-b-0">
                    <span>{row.step}</span>
                    <span className="text-right font-semibold">{row.users.toLocaleString("ru-RU")}</span>
                    <span className="text-right">{row.conversion}</span>
                    <span className="text-right">{row.drop}</span>
                  </div>
                ))}
              </div>
              {!funnels.isLoading && !funnelRows.length ? <EmptyState title="Воронка пуста" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "retention" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Когорты удержания (D1/D7/D30)</CardTitle></CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              {retention.isLoading ? <Skeleton className="h-60 w-full" /> : null}
              <div className="min-w-[720px] space-y-1">
                {(retention.data?.cohorts ?? []).map((row) => (
                  <div key={row.cohortWeek} className="grid grid-cols-[160px_1fr_1fr_1fr_1fr] gap-2 rounded-xl border border-border bg-surface2/70 p-2 text-sm">
                    <p>{row.cohortWeek}</p>
                    <p>{row.cohortSize}</p>
                    <p>{Math.round(row.d1Rate * 100)}%</p>
                    <p>{Math.round(row.d7Rate * 100)}%</p>
                    <p>{Math.round(row.d30Rate * 100)}%</p>
                  </div>
                ))}
              </div>
              {!retention.isLoading && !(retention.data?.cohorts?.length ?? 0) ? <EmptyState title="Нет когорт за период" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "experiments" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Создать/обновить эксперимент</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="key" value={expForm.key} onChange={(e) => setExpForm((s) => ({ ...s, key: e.target.value }))} />
              <Input type="number" placeholder="rollout %" value={expForm.rollout_percent} onChange={(e) => setExpForm((s) => ({ ...s, rollout_percent: Number(e.target.value) }))} />
              <Input placeholder="primary metric" value={expForm.primary_metric} onChange={(e) => setExpForm((s) => ({ ...s, primary_metric: e.target.value }))} />
              <select className="admin-select w-full" value={expForm.status} onChange={(e) => setExpForm((s) => ({ ...s, status: e.target.value }))}>
                <option value="draft">draft</option>
                <option value="running">running</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>
              <ActionButton className="w-full" state={actionUi.createExperiment} idleLabel={<><Beaker className="mr-1 h-4 w-4" />Сохранить эксперимент</>} loadingLabel="Сохранение..." successLabel={actionUi.createExperiment?.label} onClick={createExperiment} />
              <InlineError message={actionUi.createExperiment?.error} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Список экспериментов</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {experiments.isLoading ? <Skeleton className="h-56 w-full" /> : null}
              {(experiments.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <p className="font-medium">{x.key}</p>
                  <p className="text-xs text-muted">status: {x.status} · rollout: {x.rollout_percent}% · metric: {x.primary_metric || "-"}</p>
                  <p className="text-xs text-muted">A/B: insufficient data</p>
                </div>
              ))}
              {!experiments.isLoading && !(experiments.data?.items?.length ?? 0) ? <EmptyState title="Нет экспериментов" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "flags" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Feature Flags</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(flags.data?.flags ?? []).map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <div>
                    <p className="font-medium">{f.key}</p>
                    <p className="text-xs text-muted">{f.description ?? "без описания"}</p>
                  </div>
                  <ActionButton size="sm" state={actionUi[`flag-${f.id}`]} variant={f.enabled ? "secondary" : "default"} idleLabel={f.enabled ? "Выключить" : "Включить"} loadingLabel="Обновление..." successLabel={actionUi[`flag-${f.id}`]?.label} onClick={() => toggleFlag(f)} />
                </div>
              ))}
              {!flags.data?.flags?.length ? <EmptyState title="Нет feature flags" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Remote Config</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="key" value={configForm.key} onChange={(e) => setConfigForm((s) => ({ ...s, key: e.target.value }))} />
              <Textarea placeholder='{"value":7}' value={configForm.value} onChange={(e) => setConfigForm((s) => ({ ...s, value: e.target.value }))} />
              <Input placeholder="description" value={configForm.description} onChange={(e) => setConfigForm((s) => ({ ...s, description: e.target.value }))} />
              <ActionButton className="w-full" state={actionUi.upsertConfig} idleLabel={<><SlidersHorizontal className="mr-1 h-4 w-4" />Сохранить config</>} loadingLabel="Сохранение..." successLabel={actionUi.upsertConfig?.label} onClick={upsertConfig} />
              <InlineError message={actionUi.upsertConfig?.error} />
              {(flags.data?.configs ?? []).map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface2/70 p-2 text-xs">
                  <p className="font-medium">{c.key}</p>
                  <p className="text-muted">{JSON.stringify(c.value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "alerts" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Создать алерт</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="metric" value={alertsForm.metric} onChange={(e) => setAlertsForm((s) => ({ ...s, metric: e.target.value }))} />
              <Input placeholder="type" value={alertsForm.type} onChange={(e) => setAlertsForm((s) => ({ ...s, type: e.target.value }))} />
              <Input type="number" placeholder="threshold" value={alertsForm.threshold} onChange={(e) => setAlertsForm((s) => ({ ...s, threshold: Number(e.target.value) }))} />
              <Input type="number" placeholder="window days" value={alertsForm.window_days} onChange={(e) => setAlertsForm((s) => ({ ...s, window_days: Number(e.target.value) }))} />
              <div className="flex gap-2">
                <ActionButton className="flex-1" state={actionUi.createAlert} idleLabel="Сохранить алерт" loadingLabel="Сохранение..." successLabel={actionUi.createAlert?.label} onClick={createAlert} />
                <ActionButton className="flex-1" state={actionUi.checkTracking} variant="secondary" idleLabel="Проверить сейчас" loadingLabel="Проверка..." successLabel={actionUi.checkTracking?.label} onClick={checkTracking} />
              </div>
              <InlineError message={actionUi.createAlert?.error ?? actionUi.checkTracking?.error} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Последние срабатывания / список алертов</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(alerts.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <p className="font-medium">{x.metric}</p>
                  <p className="text-xs text-muted">{x.type} · threshold {x.threshold} · window {x.window_days}d · {x.status}</p>
                </div>
              ))}
              {!alerts.data?.items?.length ? <EmptyState title="Алертов пока нет" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "users" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Users 360</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Поиск по id/имени/телефону" />
              <AnimatePresence initial={false}>
                {(users.data?.items ?? []).map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={cn("rounded-xl border bg-surface2/70 p-3 text-sm transition", isRowUpdated(u.id) ? "border-cyan/50 ring-1 ring-cyan/30" : "border-border")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted">{u.phone} · {u.role}</p>
                      </div>
                      <div className="text-xs text-muted">flags {u.openFlags} · reports {u.openReports} · posts30 {u.posts_30d ?? 0} · joins30 {u.joins_30d ?? 0} · connect30 {u.connects_sent_30d ?? 0} · risk {u.risk_score ?? 0}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {u.is_blocked ? <span className="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">blocked</span> : null}
                      {u.shadow_banned ? <span className="rounded-full border border-warning px-2 py-0.5 text-xs text-warning">shadowbanned</span> : null}
                      {u.message_limited ? <span className="rounded-full border border-warning px-2 py-0.5 text-xs text-warning">limited</span> : null}
                      <UpdatedBadge show={isRowUpdated(u.id)} text="Updated" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton state={actionUi[`moderate-${u.id}`]} size="sm" variant="secondary" idleLabel="limit" loadingLabel="Applying..." successLabel={actionUi[`moderate-${u.id}`]?.label} onClick={() => moderate({ targetType: "user", targetId: u.id, action: "shadowban" })} />
                      <ActionButton state={actionUi[`moderate-${u.id}`]} size="sm" variant="danger" idleLabel="block" loadingLabel="Applying..." successLabel={actionUi[`moderate-${u.id}`]?.label} onClick={() => moderate({ targetType: "user", targetId: u.id, action: "block_user" })} />
                      <Link href={`/admin/users/${u.id}`}><Button size="sm" variant="secondary">Открыть 360</Button></Link>
                    </div>
                    <InlineError message={actionUi[`moderate-${u.id}`]?.error} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!users.data?.items?.length ? <EmptyState title="Пользователи не найдены" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "risk" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p>low: {risk.data?.distribution?.low ?? 0}</p>
                <p>medium: {risk.data?.distribution?.medium ?? 0}</p>
                <p>high: {risk.data?.distribution?.high ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p className="mb-1 text-xs text-muted">Top signals</p>
                {(risk.data?.topSignals ?? []).map((s: any) => <p key={s.key} className="text-xs">• {s.key}: {s.count}</p>)}
                {!(risk.data?.topSignals?.length ?? 0) ? <p className="text-xs text-muted">Нет сигналов</p> : null}
              </div>
            </CardContent>
          </Card>

          <div className="xl:col-span-2">
            <Card>
              <CardHeader><CardTitle>Risk Center (внутренний)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <AnimatePresence initial={false}>
                  {(risk.data?.items ?? []).slice(0, 80).map((r: any) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("rounded-xl border bg-surface2/70 p-3 text-sm transition", isRowUpdated(r.id) ? "border-cyan/50 ring-1 ring-cyan/30" : "border-border")}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{r.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${r.risk_status === "high" ? "border-danger text-danger" : r.risk_status === "medium" ? "border-warning text-warning" : "border-action text-action"}`}>
                          {r.risk_status} · {r.risk_score}
                        </span>
                      </div>
                      <p className="text-xs text-muted">signals: {(r.signals ?? []).join(", ") || "-"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ActionButton state={actionUi[`moderate-${r.id}`]} size="sm" variant="secondary" idleLabel="Mark safe" loadingLabel="Applying..." successLabel={actionUi[`moderate-${r.id}`]?.label} onClick={() => moderate({ targetType: "user", targetId: r.id, action: "mark_safe" })} />
                        <ActionButton state={actionUi[`moderate-${r.id}`]} size="sm" variant="secondary" idleLabel="Apply limit" loadingLabel="Applying..." successLabel={actionUi[`moderate-${r.id}`]?.label} onClick={() => moderate({ targetType: "user", targetId: r.id, action: "shadowban" })} />
                        <ActionButton state={actionUi[`moderate-${r.id}`]} size="sm" variant="danger" idleLabel="Block" loadingLabel="Applying..." successLabel={actionUi[`moderate-${r.id}`]?.label} onClick={() => moderate({ targetType: "user", targetId: r.id, action: "block_user" })} />
                        <Link href={`/admin/users/${r.id}`}><Button size="sm" variant="secondary">View user</Button></Link>
                      </div>
                      <InlineError message={actionUi[`moderate-${r.id}`]?.error} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!risk.data?.items?.length ? <EmptyState title="Нет риск-профилей" onSeed={seedDemo} onCheck={checkTracking} /> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {section === "reports" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Reports Inbox</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <AnimatePresence initial={false}>
                {(reports.data?.items ?? []).slice(0, 120).map((r) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("rounded-xl border bg-surface2/70 p-3 text-sm transition", isRowUpdated(r.id) ? "border-cyan/50 ring-1 ring-cyan/30" : "border-border")}>
                    <p className="font-medium">{r.content_type} · {r.reason}</p>
                    <p className="text-xs text-muted">{r.status}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton state={actionUi[`report-${r.id}`]} size="sm" variant="secondary" idleLabel="Review" loadingLabel="Updating..." successLabel={actionUi[`report-${r.id}`]?.label} onClick={() => updateReportStatus(r.id, "in_review")} />
                      <ActionButton state={actionUi[`report-${r.id}`]} size="sm" variant="secondary" idleLabel="Resolve" loadingLabel="Updating..." successLabel={actionUi[`report-${r.id}`]?.label} onClick={() => updateReportStatus(r.id, "resolved")} />
                    </div>
                    <InlineError message={actionUi[`report-${r.id}`]?.error} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!reports.data?.items?.length ? <EmptyState title="Жалоб нет" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "moderation" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Reactive AI Flags</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea value={moderationReason} onChange={(e) => setModerationReason(e.target.value)} />
              <AnimatePresence initial={false}>
                {(moderation.data?.flags ?? []).slice(0, 50).map((f: any) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("rounded-xl border bg-surface2/70 p-3 text-sm transition", isRowUpdated(f.id) ? "border-cyan/50 ring-1 ring-cyan/30" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{f.content_type} · risk {f.risk_score}</p>
                      <AlertTriangle className="h-4 w-4 text-[#ffb86b]" />
                    </div>
                    <p className="text-xs text-muted">{f.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton state={actionUi[`moderate-${f.id}`]} size="sm" variant="secondary" idleLabel="Mark reviewed" loadingLabel="Applying..." successLabel={actionUi[`moderate-${f.id}`]?.label} onClick={() => moderate({ targetType: "flag", targetId: f.id, action: "resolve_report" })} />
                      <ActionButton state={actionUi[`moderate-${f.id}`]} size="sm" variant="danger" idleLabel="Remove" loadingLabel="Applying..." successLabel={actionUi[`moderate-${f.id}`]?.label} onClick={() => moderate({ targetType: f.content_type, targetId: f.content_id, action: "remove_content" })} />
                      <ActionButton state={actionUi[`moderate-${f.id}`]} size="sm" idleLabel="Mark safe" loadingLabel="Applying..." successLabel={actionUi[`moderate-${f.id}`]?.label} onClick={() => moderate({ targetType: f.content_type, targetId: f.content_id, action: "mark_safe" })} />
                    </div>
                    <InlineError message={actionUi[`moderate-${f.id}`]?.error} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!moderation.data?.flags?.length ? <EmptyState title="Нет открытых AI-флагов" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "assistant" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>AI Admin Analyst</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {aiError ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">Ошибка AI: {aiError}</div> : null}

              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface2/70 p-3">
                {!aiLog.length ? <p className="text-xs text-muted">Спроси: почему упал TG verify, где провал в воронке, что влияет на WMC.</p> : null}
                {aiLog.map((m, i) => (
                  <motion.div key={`${m.role}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-3 text-sm ${m.role === "assistant" ? "border-cyan/30 bg-[#143053]/50" : "border-border bg-surface2/80"}`}>
                    <p className="mb-1 text-xs text-muted">{m.role === "assistant" ? "AI" : "Ты"}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </motion.div>
                ))}
              </div>

              {aiActions.length ? (
                <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="text-xs text-muted">Исполнимые рекомендации</p>
                  {aiActions.map((action) => (
                    <div key={action.id} className="flex flex-col gap-2 rounded-lg border border-border p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <p>{action.label}</p>
                      <ActionButton size="sm" state={actionUi[`applyAi-${action.id}`]} variant={appliedAiActions[action.id] ? "secondary" : "default"} idleLabel={appliedAiActions[action.id] ? "Applied" : "Apply suggestion"} loadingLabel="Applying..." successLabel={actionUi[`applyAi-${action.id}`]?.label} disabledReason={appliedAiActions[action.id] ? "Уже применено" : undefined} onClick={() => applyAiAction(action)} />
                    </div>
                  ))}
                </div>
              ) : null}

              {aiDebugMode && aiDebugPayload ? (
                <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="text-xs text-muted">AI debug context</p>
                  <pre className="max-h-48 overflow-auto text-[11px] leading-relaxed text-muted">{JSON.stringify(aiDebugPayload, null, 2)}</pre>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Почему упал TG verify за 7 дней?" />
                <Button variant="secondary" onClick={() => setAiDebugMode((v) => !v)}>{aiDebugMode ? "Debug ON" : "Debug OFF"}</Button>
                <ActionButton state={actionUi.askAI} idleLabel={<><Bot className="mr-1 h-4 w-4" />Спросить</>} loadingLabel="Анализ..." successLabel={actionUi.askAI?.label} onClick={askAI} />
              </div>
              <InlineError message={actionUi.askAI?.error} />
            </CardContent>
          </Card>
        </div>
      ) : null}


      {section === "metrics_lab" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Метрики (Metrics Lab)</CardTitle></CardHeader>
            <CardContent className="space-y-4 font-sans">
              <div className="flex flex-wrap gap-2">
                {(["growth","activation","engagement","content","events","social","safety","ai","health"] as const).map((tab) => (
                  <Button key={tab} size="sm" variant={metricsTab === tab ? "default" : "secondary"} onClick={() => setMetricsTab(tab)}>{metricsTabLabels[tab]}</Button>
                ))}
              </div>

              {metricsLab.isLoading ? <Skeleton className="h-60 w-full" /> : null}

              {!metricsLab.isLoading && !(metricsLab.data?.kpis?.length ?? 0) ? (
                <EmptyState title="Метрики Lab пусты" onSeed={seedDemo} onCheck={checkTracking} />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {(metricsLab.data?.kpis ?? []).map((k) => (
                    <div key={k.name} className="rounded-xl border border-border bg-surface2/70 p-3">
                      <p className="text-sm text-muted">{k.name}</p>
                      <p className="mt-1 text-2xl font-semibold text-text">{formatMetricValue(k.name, Number(k.value ?? 0))}</p>
                      {k.subtitle ? <p className="text-xs text-muted">{k.subtitle}</p> : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {(metricsLab.data?.trends ?? []).slice(0, 2).map((t) => (
                  <TrendChart key={t.key} title={"Тренд: " + t.key} points={t.points} />
                ))}
                <TrendChart title={"Серия: " + seriesMetric} points={normalizedSeriesPoints.map((p) => ({ date: p.ts, value: p.value }))} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-base font-semibold">Дневной срез ({dateRange})</p>
                  <div className="overflow-auto rounded-xl border border-border/40">
                    <div className="grid min-w-[420px] grid-cols-[1fr_auto] gap-2 border-b border-border/40 bg-surface2/80 px-3 py-2 text-sm font-semibold">
                      <span>Дата</span>
                      <span>Значение</span>
                    </div>
                    {normalizedSeriesPoints.slice(-14).map((p) => (
                      <div key={p.ts} className="grid min-w-[420px] grid-cols-[1fr_auto] gap-2 border-b border-border/30 px-3 py-2 text-sm last:border-b-0">
                        <span>{p.ts}</span>
                        <span className="font-semibold">{p.value.toLocaleString("ru-RU")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-base font-semibold">Конверсии воронки</p>
                  <div className="overflow-auto rounded-xl border border-border/40">
                    <div className="grid min-w-[520px] grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border/40 bg-surface2/80 px-3 py-2 text-sm font-semibold">
                      <span>Шаг</span>
                      <span className="text-right">Пользователи</span>
                      <span className="text-right">Конверсия</span>
                      <span className="text-right">Drop</span>
                    </div>
                    {funnelRows.slice(0, 8).map((row) => (
                      <div key={row.step} className="grid min-w-[520px] grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border/30 px-3 py-2 text-sm last:border-b-0">
                        <span>{row.step}</span>
                        <span className="text-right font-semibold">{row.users.toLocaleString("ru-RU")}</span>
                        <span className="text-right">{row.conversion}</span>
                        <span className="text-right">{row.drop}</span>
                      </div>
                    ))}
                    {!funnelRows.length ? <p className="p-3 text-sm text-muted">Нет данных воронки. Запусти симуляцию или seed.</p> : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-base font-semibold">Топ пользователей ({topUsersMetrics.data?.metric ?? "-"})</p>
                  {(topUsersMetrics.data?.items ?? []).length ? (
                    (topUsersMetrics.data?.items ?? []).map((x) => (
                      <div key={x.user_id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/40 py-2 text-sm last:border-b-0">
                        <p>{x.name} {x.city ? "· " + x.city : ""}</p>
                        <p className="font-semibold">{x.value.toLocaleString("ru-RU")}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">Нет данных. Запусти Live 40 users.</p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-base font-semibold">Топ событий ({topEventsMetrics.data?.metric ?? "-"})</p>
                  {(topEventsMetrics.data?.items ?? []).length ? (
                    (topEventsMetrics.data?.items ?? []).map((x) => (
                      <div key={x.event_id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/40 py-2 text-sm last:border-b-0">
                        <p>{x.title}</p>
                        <p className="font-semibold">{x.value.toLocaleString("ru-RU")}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">Нет данных. Запусти Live 40 users.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "simulation" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Симуляция / Демо-данные</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input type="number" value={simConfig.users} onChange={(e) => setSimConfig((s) => ({ ...s, users: Number(e.target.value) }))} placeholder="users" />
              <Input type="number" value={simConfig.days} onChange={(e) => setSimConfig((s) => ({ ...s, days: Number(e.target.value) }))} placeholder="days" />
              <select className="admin-select w-full" value={simConfig.scenario} onChange={(e) => setSimConfig((s) => ({ ...s, scenario: e.target.value as any }))}>
                <option value="normal">normal</option>
                <option value="spike">spike</option>
                <option value="drop">drop</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setSimConfig((s) => ({ ...s, days: 30 }))}>Сгенерировать 30 дней</Button>
                <Button onClick={() => setSimConfig((s) => ({ ...s, days: 90 }))}>Сгенерировать 90 дней</Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ActionButton state={actionUi.seedMinimal} variant="secondary" idleLabel="Seed Minimal" loadingLabel="Seeding..." successLabel={actionUi.seedMinimal?.label} onClick={seedMinimal} />
                <ActionButton state={actionUi.seedDemo} idleLabel="Run simulation" loadingLabel="Running..." successLabel={actionUi.seedDemo?.label} onClick={seedDemo} />
              </div>
              <InlineError message={actionUi.seedMinimal?.error ?? actionUi.seedDemo?.error} />
            </CardContent>
          </Card>

          <motion.div
            animate={{ boxShadow: liveSim.data?.running ? "0 0 0 1px rgba(82,204,131,0.35), 0 16px 36px rgba(82,204,131,0.2)" : "0 0 0 1px rgba(148,163,184,0.18)" }}
            transition={{ duration: 0.28 }}
          >
            <Card>
              <CardHeader><CardTitle>Live Simulation</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <p>
                    LIVE: <strong className={cn(liveSim.data?.running ? "text-action" : "text-muted")}>{liveSim.data?.running ? "RUNNING" : "STOPPED"}</strong>
                    {liveSim.data?.running ? <span className="ml-2 inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-action" /> : null}
                  </p>
                  <p>run id: {liveSim.data?.run?.id?.slice(0, 8) ?? "-"}</p>
                  <p>users: {liveSim.data?.run?.users_count ?? liveConfig.users_count}</p>
                  <p className="flex items-center gap-2">
                    total events: <strong>{liveSim.data?.run?.total_events_generated ?? 0}</strong>
                    <AnimatePresence>
                      {liveBurst > 0 ? (
                        <motion.span
                          key={liveBurst}
                          initial={{ opacity: 0, y: 6, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.9 }}
                          className="rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan"
                        >
                          +{liveBurst} events
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </p>
                  <p>
                    events/min: 
                    <motion.span
                      key={liveSim.data?.events_per_minute ?? 0}
                      initial={{ scale: 0.96, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="ml-1 inline-block font-semibold"
                    >
                      {liveSim.data?.events_per_minute ?? 0}
                    </motion.span>
                  </p>
                  <p>events 24h: {liveSim.data?.events_24h ?? 0}</p>
                  <p>interval: {liveSim.data?.run?.interval_sec ?? liveConfig.interval_sec}s</p>
                  <p>mode/intensity: {liveSim.data?.run?.mode ?? liveConfig.mode} / {liveSim.data?.run?.intensity ?? liveConfig.intensity}</p>
                  {liveSim.data?.cron_warning ? <p className="text-xs text-warning">{liveSim.data.cron_warning}</p> : null}
                </div>
                <Input type="number" value={liveConfig.users_count} onChange={(e) => setLiveConfig((s) => ({ ...s, users_count: Number(e.target.value) }))} placeholder="users count" />
                <Input type="number" value={liveConfig.interval_sec} onChange={(e) => setLiveConfig((s) => ({ ...s, interval_sec: Number(e.target.value) }))} placeholder="interval sec" />
                <Input type="number" value={liveConfig.events_per_tick} onChange={(e) => setLiveConfig((s) => ({ ...s, events_per_tick: Number(e.target.value) }))} placeholder="events per tick" />
                <select className="admin-select w-full" value={liveConfig.mode} onChange={(e) => setLiveConfig((s) => ({ ...s, mode: e.target.value as "normal" | "chaos" }))}>
                  <option value="normal">normal</option>
                  <option value="chaos">chaos</option>
                </select>
                <select className="admin-select w-full" value={liveConfig.intensity} onChange={(e) => setLiveConfig((s) => ({ ...s, intensity: e.target.value as "low" | "normal" | "high" }))}>
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ActionButton
                    className="w-full"
                    state={actionUi.startLive}
                    idleLabel="Start"
                    loadingLabel="Starting..."
                    successLabel={actionUi.startLive?.label}
                    disabledReason={!liveSim.data?.devtools?.enabled ? liveSim.data?.devtools?.reason : undefined}
                    onClick={() => startLive()}
                  />
                  <ActionButton className="w-full" state={actionUi.stopLive} variant="secondary" idleLabel="Stop" loadingLabel="Stopping..." successLabel={actionUi.stopLive?.label} onClick={stopLive} />
                  <ActionButton className="w-full" state={actionUi.tickLive} variant="secondary" idleLabel="Tick" loadingLabel="Ticking..." successLabel={actionUi.tickLive?.label} onClick={tickLive} />
                </div>
                <InlineError message={actionUi.startLive?.error ?? actionUi.stopLive?.error ?? actionUi.tickLive?.error} />
                <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs">
                  <p className="mb-1 text-muted">Recent actions</p>
                  <AnimatePresence initial={false}>
                    {(liveSim.data?.run?.recent_actions ?? []).slice(0, 10).map((x: string, idx: number) => (
                      <motion.p key={x + idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>• {x}</motion.p>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      ) : null}

      {section === "integrations" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Интеграции</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(integrations.data?.items ?? []).map((i) => (
                <div key={i.key} className="rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <p className="font-medium">{i.key}</p>
                  <p className="text-xs text-muted">status: {i.status} · configured: {String(i.configured)} · errors7d: {i.errors7d ?? 0}</p>
                </div>
              ))}
              {!integrations.data?.items?.length ? <EmptyState title="Интеграции не обнаружены" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "security" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Access & RBAC</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p>Роли: {Object.entries(security.data?.roleCounts ?? {}).map(([k, v]) => `${k}:${v}`).join(" · ") || "-"}</p>
                <p>Blocked users: {security.data?.blockedUsers ?? 0}</p>
                <p>Active sessions: {security.data?.activeSessions ?? 0}</p>
                <p>Devtools: {security.data?.devtools?.enabled ? "enabled" : "disabled"} · {security.data?.devtools?.reason ?? "-"}</p>
              </div>

              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p className="mb-1 text-xs text-muted">Админы и роли</p>
                {(security.data?.admins ?? []).slice(0, 8).map((a: any) => <p key={a.id} className="text-xs">• {a.name ?? a.id.slice(0, 6)} · {a.role}</p>)}
                {!(security.data?.admins?.length ?? 0) ? <p className="text-xs text-muted">Нет админ-пользователей</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>API Protection Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p>{security.data?.apiProtection?.rateLimitingEnabled ? "✅" : "⚠️"} rate limiting на /api/admin/*</p>
              <p>{security.data?.apiProtection?.csrfProtection ? "✅" : "⚠️"} CSRF защита state-changing endpoints</p>
              <p>{security.data?.apiProtection?.zodValidationCoverage ? "✅" : "⚠️"} Zod validation coverage</p>
              <p>{security.data?.apiProtection?.serverOnlySecrets ? "✅" : "⚠️"} server-only secrets</p>

              <div className="mt-3 rounded-xl border border-border bg-surface2/70 p-3">
                <p className="mb-1 text-xs text-muted">Data Security</p>
                <p>{security.data?.dataSecurity?.rlsEnabledAssumed ? "✅" : "⚠️"} RLS enabled</p>
                <p>{security.data?.dataSecurity?.piiMaskedInUi ? "✅" : "⚠️"} PII masked in UI</p>
                <p>{security.data?.dataSecurity?.logsContainSecrets ? "⚠️ logs contain secrets" : "✅ logs do not contain secrets"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Threat Monitoring</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p>events24h: {security.data?.threatMonitoring?.events24h ?? 0}</p>
                <p>reports24h: {security.data?.threatMonitoring?.reports24h ?? 0}</p>
                <p>connect24h: {security.data?.threatMonitoring?.connect24h ?? 0}</p>
                <p>aiErrors24h: {security.data?.threatMonitoring?.aiErrors24h ?? 0}</p>
              </div>
              {(security.data?.threatMonitoring?.triggers ?? []).map((t: any) => (
                <div key={t.key} className={`rounded-xl border p-2 ${t.level === "critical" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning"}`}>
                  <p className="font-medium">{t.key}</p>
                  <p>{t.message}</p>
                </div>
              ))}
              {!(security.data?.threatMonitoring?.triggers?.length ?? 0) ? <p className="text-muted">Триггеров нет</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(security.data?.auditLog ?? security.data?.recentAdminActions ?? []).slice(0, 25).map((a: any) => <p key={a.id}>• {a.action} · {new Date(a.created_at).toLocaleString("ru-RU")}</p>)}
              {!((security.data?.auditLog ?? security.data?.recentAdminActions ?? []).length) ? <EmptyState title="Нет записей audit" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "system" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>System Settings</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(system.data?.items ?? []).map((item) => (
                <div key={item.key} className="rounded-xl border border-border bg-surface2/70 p-3 text-sm">
                  <p className="font-medium">{item.key}</p>
                  <p className="text-xs text-muted">{JSON.stringify(item.value)}</p>
                  <ActionButton className="mt-2" size="sm" state={actionUi[`saveSystem-${item.key}`]} variant="secondary" idleLabel="Сохранить" loadingLabel="Сохранение..." successLabel={actionUi[`saveSystem-${item.key}`]?.label} onClick={() => saveSystemSetting(item.key, item.value)} />
                  <InlineError message={actionUi[`saveSystem-${item.key}`]?.error} />
                </div>
              ))}
              {!system.data?.items?.length ? <EmptyState title="System settings пусты" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Справочные тексты</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea defaultValue="Нет данных за период. Проверьте трекинг событий или сгенерируйте демо-данные." />
              <Button variant="secondary">Сохранить текст</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "backup" ? (
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Экспорт CSV</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["users", "reports", "events", "feature_flags", "experiments"] as const).map((table) => (
                <Button key={table} variant="secondary" onClick={() => exportCSV(table)}><Download className="mr-1 h-4 w-4" />{table}</Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Disaster checklist</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted space-y-1">
              <p>1. Проверить Supabase status</p>
              <p>2. Проверить Vercel deploy</p>
              <p>3. Отключить risky flags</p>
              <p>4. Экспортировать users/reports/events</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="col-span-12">
        <Card>
          <CardHeader><CardTitle>Быстрые действия</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSection("overview")}><SlidersHorizontal className="mr-1 h-4 w-4" />Обзор</Button>
            <Button variant="secondary" onClick={() => setSection("metrics_lab")}><SlidersHorizontal className="mr-1 h-4 w-4" />Metrics Lab</Button>
            <Button variant="secondary" onClick={() => setSection("simulation")}><Plus className="mr-1 h-4 w-4" />Simulation</Button>
            <Button variant="secondary" onClick={() => setSection("users")}><Users className="mr-1 h-4 w-4" />Users 360</Button>
            <Button variant="secondary" onClick={() => setSection("moderation")}><Shield className="mr-1 h-4 w-4" />Модерация</Button>
            <Button variant="secondary" onClick={() => setSection("reports")}><Flag className="mr-1 h-4 w-4" />Reports</Button>
            <Button variant="secondary" onClick={checkTracking}><RefreshCw className="mr-1 h-4 w-4" />Проверить трекинг</Button>
            <Button variant="secondary" onClick={runDiagnostics}><RefreshCw className="mr-1 h-4 w-4" />Run Diagnostics</Button>
            <Button onClick={seedDemo} disabled={isSeedLoading}>{isSeedLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}Seed demo data</Button>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
