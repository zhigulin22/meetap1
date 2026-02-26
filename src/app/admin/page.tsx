"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
  featureFlagsResponseSchema,
  funnelsResponseSchema,
  moderationQueueResponseSchema,
  overviewResponseSchema,
  retentionResponseSchema,
  userSearchResponseSchema,
} from "@/lib/admin-schemas";
import { api } from "@/lib/api-client";

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

function TrendChart({ title, points }: { title: string; points: Array<{ date: string; value: number }> }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {!points.length ? (
          <div className="text-xs text-muted">Нет точек</div>
        ) : (
          <div className="grid grid-cols-12 items-end gap-1 h-28">
            {points.slice(-24).map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1">
                <div className="w-2 rounded-t bg-cyan/70" style={{ height: `${Math.max(4, (p.value / max) * 84)}px` }} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
  const [moderationReason, setModerationReason] = useState("Нарушение правил платформы");
  const [isSeedLoading, setSeedLoading] = useState(false);
  const [alertsForm, setAlertsForm] = useState({ metric: "tg_verify_rate", type: "drop", threshold: 0.2, window_days: 7 });
  const [expForm, setExpForm] = useState({ key: "", rollout_percent: 20, status: "draft", primary_metric: "WMC" });
  const [configForm, setConfigForm] = useState({ key: "feed_lock_days", value: '{"value":7}', description: "" });
  const [metricsTab, setMetricsTab] = useState<"growth" | "activation" | "engagement" | "content" | "events" | "social" | "safety" | "ai" | "health">("growth");
  const [simConfig, setSimConfig] = useState({ users: 300, days: 30, scenario: "normal" as "normal" | "spike" | "drop", intervalSec: 8, eventsPerTick: 25 });

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
  const risk = useQuery({ queryKey: ["admin-risk-v3"], queryFn: () => api<{ items: any[] }>("/api/admin/risk") });
  const reports = useQuery({ queryKey: ["admin-reports-v3"], queryFn: () => api<{ items: any[] }>("/api/admin/reports") });
  const integrations = useQuery({ queryKey: ["admin-integrations"], queryFn: () => api<{ items: any[]; apiErrors7d: number }>("/api/admin/integrations/status") });
  const security = useQuery({ queryKey: ["admin-security"], queryFn: () => api<{ roleCounts: Record<string, number>; blockedUsers: number; activeSessions: number; recentAdminActions: any[] }>("/api/admin/security/overview") });
  const system = useQuery({ queryKey: ["admin-system"], queryFn: () => api<{ items: any[] }>("/api/admin/system/settings") });

  const metricsLab = useQuery({
    queryKey: ["admin-metrics-lab", metricsTab, fromISO, toISO, segment],
    queryFn: () => api<{ kind: string; kpis: Array<{ name: string; value: number; subtitle?: string | null }>; trends: Array<{ key: string; points: Array<{ date: string; value: number }> }>; top: any[] }>(`/api/admin/metrics/${metricsTab}?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`),
  });

  const liveSim = useQuery({
    queryKey: ["admin-live-sim"],
    queryFn: () => api<{ running: boolean; intervalSec: number; eventsPerTick: number; totalGenerated: number; lastTickAt: number }>("/api/admin/dev/live-simulation"),
    refetchInterval: 4000,
  });

  async function seedDemo() {
    try {
      setSeedLoading(true);
      const res = await api<{ insertedEvents: number }>("/api/admin/dev/seed-analytics", { method: "POST", body: JSON.stringify(simConfig) });
      toast.success(`Сгенерировано ${res.insertedEvents} событий`);
      await Promise.all([
        overview.refetch(),
        funnels.refetch(),
        retention.refetch(),
        users.refetch(),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка seed");
    } finally {
      setSeedLoading(false);
    }
  }

  async function checkTracking() {
    try {
      await api("/api/admin/health/test-event", { method: "POST" });
      const res = await api<{ triggered: any[]; dataMissingEvents24h: string[] }>("/api/admin/alerts/check", { method: "POST" });
      if (res.dataMissingEvents24h.length) {
        toast.warning(`Нет данных 24ч: ${res.dataMissingEvents24h.join(", ")}`);
      } else {
        toast.success("Трекинг активен");
      }
      if (res.triggered.length) {
        toast.info(`Сработало алертов: ${res.triggered.length}`);
      }
      alerts.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка проверки");
    }
  }

  async function moderate(action: any) {
    try {
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

      toast.success("Действие применено");
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-v5"] });
      queryClient.invalidateQueries({ queryKey: ["admin-risk-v3"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports-v3"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-v5"] });
      queryClient.invalidateQueries({ queryKey: ["admin-security"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка модерации");
    }
  }

  async function askAI() {
    if (aiQuestion.trim().length < 3) return;
    const q = aiQuestion.trim();
    setAiQuestion("");
    setAiLog((prev) => [...prev, { role: "user", text: q }]);

    try {
      const res = await adminApi("/api/admin/ai/insights", aiInsightsResponseSchema, {
        method: "POST",
        body: JSON.stringify({
          question: q,
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
        `Ключевые выводы: ${res.key_findings.join(" | ")}`,
        `Доказательства: ${res.evidence.join(" | ")}`,
        `Рекомендованные действия: ${res.recommended_actions.join(" | ")}`,
      ].join("\n\n");

      setAiLog((prev) => [...prev, { role: "assistant", text: answer }]);
      setSection("assistant");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка AI");
    }
  }

  async function toggleFlag(flag: any) {
    await api("/api/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify({ ...flag, enabled: !flag.enabled }),
    });
    flags.refetch();
  }

  async function createAlert() {
    await api("/api/admin/alerts", { method: "POST", body: JSON.stringify(alertsForm) });
    toast.success("Алерт создан");
    alerts.refetch();
  }

  async function createExperiment() {
    if (!expForm.key.trim()) return toast.error("Укажи key");
    await api("/api/admin/experiments", {
      method: "POST",
      body: JSON.stringify({ ...expForm, variants: { A: "control", B: "variant" } }),
    });
    toast.success("Эксперимент сохранен");
    experiments.refetch();
  }

  async function upsertConfig() {
    try {
      await api("/api/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify({ kind: "config", key: configForm.key, value: JSON.parse(configForm.value), description: configForm.description }),
      });
      toast.success("Config сохранен");
      flags.refetch();
    } catch {
      toast.error("Проверь JSON value");
    }
  }

  async function saveSystemSetting(key: string, value: Record<string, unknown>) {
    await api("/api/admin/system/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
    toast.success("Сохранено");
    system.refetch();
  }

  function exportCSV(table: string) {
    window.open(`/api/admin/export?table=${encodeURIComponent(table)}`, "_blank");
  }

  const isOverviewLoading = overview.isLoading;
  const noData = !isOverviewLoading && Object.keys(overview.data?.overview ?? {}).length === 0;

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
                      {typeof v === "number" ? (k.toLowerCase().includes("rate") || k === "dauMau" || k === "profileCompletionRate" ? `${Math.round(v * 100)}%` : v) : String(v)}
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

          <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Мини-воронка</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(overview.data?.miniFunnel ?? []).map((step) => (
                  <div key={step.step} className="rounded-xl border border-border bg-black/10 p-3">
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
              <CardHeader><CardTitle>Health + Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-xl border border-border bg-black/10 p-3">
                  <p>p95 latency: <strong>{Math.round(overview.data?.health?.p95Latency ?? 0)} ms</strong></p>
                  <p>Ошибки интеграций 7д: <strong>{overview.data?.health?.integrations.integrationErrors7d ?? 0}</strong></p>
                  <p>TG: {(overview.data?.health?.integrations.telegramConfigured ?? false) ? "OK" : "MISSING"}</p>
                  <p>OpenAI: {(overview.data?.health?.integrations.openAiConfigured ?? false) ? "OK" : "MISSING"}</p>
                  <p>Supabase: {(overview.data?.health?.integrations.supabaseConfigured ?? false) ? "OK" : "MISSING"}</p>
                </div>

                <div className="rounded-xl border border-border bg-black/10 p-3">
                  <p className="mb-1 text-xs text-muted">Последние действия админов</p>
                  {(overview.data?.health?.lastAdminActions ?? []).slice(0, 6).map((a: any) => (
                    <p key={a.id} className="text-xs">• {a.action} · {new Date(a.created_at).toLocaleString("ru-RU")}</p>
                  ))}
                </div>
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
              {(funnels.data?.steps ?? []).map((step) => (
                <div key={step.step} className="rounded-xl border border-border bg-black/10 p-3">
                  <div className="flex items-center justify-between text-sm"><p>{step.step}</p><p>{step.count}</p></div>
                  <p className="text-xs text-muted">Drop: {Math.round(step.drop * 100)}% · Conv from start: {Math.round(step.conversionFromStart * 100)}%</p>
                </div>
              ))}
              {!funnels.isLoading && !(funnels.data?.steps?.length ?? 0) ? <EmptyState title="Воронка пуста" onSeed={seedDemo} onCheck={checkTracking} /> : null}
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
                  <div key={row.cohortWeek} className="grid grid-cols-[160px_1fr_1fr_1fr_1fr] gap-2 rounded-xl border border-border bg-black/10 p-2 text-sm">
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
              <Button className="w-full" onClick={createExperiment}><Beaker className="mr-1 h-4 w-4" />Сохранить эксперимент</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Список экспериментов</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {experiments.isLoading ? <Skeleton className="h-56 w-full" /> : null}
              {(experiments.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
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
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <div>
                    <p className="font-medium">{f.key}</p>
                    <p className="text-xs text-muted">{f.description ?? "без описания"}</p>
                  </div>
                  <Button size="sm" variant={f.enabled ? "secondary" : "default"} onClick={() => toggleFlag(f)}>{f.enabled ? "Выключить" : "Включить"}</Button>
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
              <Button className="w-full" onClick={upsertConfig}><SlidersHorizontal className="mr-1 h-4 w-4" />Сохранить config</Button>
              {(flags.data?.configs ?? []).map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
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
                <Button className="flex-1" onClick={createAlert}>Сохранить алерт</Button>
                <Button className="flex-1" variant="secondary" onClick={checkTracking}>Проверить сейчас</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Последние срабатывания / список алертов</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(alerts.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
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
              {(users.data?.items ?? []).map((u) => (
                <div key={u.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted">{u.phone} · {u.role}</p>
                    </div>
                    <div className="text-xs text-muted">flags {u.openFlags} · reports {u.openReports}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {u.is_blocked ? <span className="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">blocked</span> : null}
                    {u.shadow_banned ? <span className="rounded-full border border-warning px-2 py-0.5 text-xs text-warning">shadowbanned</span> : null}
                    {u.message_limited ? <span className="rounded-full border border-warning px-2 py-0.5 text-xs text-warning">limited</span> : null}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => moderate({ targetType: "user", targetId: u.id, action: "shadowban" })}>limit</Button>
                    <Button size="sm" variant="danger" onClick={() => moderate({ targetType: "user", targetId: u.id, action: "block_user" })}>block</Button>
                    <Link href={`/admin/users/${u.id}`}><Button size="sm" variant="secondary">Открыть 360</Button></Link>
                  </div>
                </div>
              ))}
              {!users.data?.items?.length ? <EmptyState title="Пользователи не найдены" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "risk" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Risk Center (внутренний)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(risk.data?.items ?? []).slice(0, 50).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">risk {r.risk_score} · {r.risk_status}</p>
                  <p className="text-xs text-muted">signals: {(r.signals ?? []).join(", ") || "-"}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => moderate({ targetType: "user", targetId: r.id, action: "mark_safe" })}>Mark safe</Button>
                    <Button size="sm" variant="secondary" onClick={() => moderate({ targetType: "user", targetId: r.id, action: "shadowban" })}>Apply limit</Button>
                    <Button size="sm" variant="danger" onClick={() => moderate({ targetType: "user", targetId: r.id, action: "block_user" })}>Block</Button>
                    <Link href={`/admin/users/${r.id}`}><Button size="sm" variant="secondary">View user</Button></Link>
                  </div>
                </div>
              ))}
              {!risk.data?.items?.length ? <EmptyState title="Нет риск-профилей" onSeed={seedDemo} onCheck={checkTracking} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "reports" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Reports Inbox</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(reports.data?.items ?? []).slice(0, 120).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{r.content_type} · {r.reason}</p>
                  <p className="text-xs text-muted">{r.status}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => api("/api/admin/reports", { method: "PUT", body: JSON.stringify({ id: r.id, status: "in_review" }) }).then(() => reports.refetch())}>Review</Button>
                    <Button size="sm" variant="secondary" onClick={() => api("/api/admin/reports", { method: "PUT", body: JSON.stringify({ id: r.id, status: "resolved" }) }).then(() => reports.refetch())}>Resolve</Button>
                  </div>
                </div>
              ))}
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
              {(moderation.data?.flags ?? []).slice(0, 50).map((f: any) => (
                <div key={f.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{f.content_type} · risk {f.risk_score}</p>
                    <AlertTriangle className="h-4 w-4 text-[#ffb86b]" />
                  </div>
                  <p className="text-xs text-muted">{f.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => moderate({ targetType: "flag", targetId: f.id, action: "resolve_report" })}>Mark reviewed</Button>
                    <Button size="sm" variant="danger" onClick={() => moderate({ targetType: f.content_type, targetId: f.content_id, action: "remove_content" })}>Remove</Button>
                    <Button size="sm" onClick={() => moderate({ targetType: f.content_type, targetId: f.content_id, action: "mark_safe" })}>Mark safe</Button>
                  </div>
                </div>
              ))}
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
              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-black/10 p-3">
                {!aiLog.length ? <p className="text-xs text-muted">Спроси: почему упал TG verify, где провал в воронке, что влияет на WMC.</p> : null}
                {aiLog.map((m, i) => (
                  <motion.div key={`${m.role}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-3 text-sm ${m.role === "assistant" ? "border-cyan/30 bg-[#143053]/50" : "border-border bg-black/20"}`}>
                    <p className="mb-1 text-xs text-muted">{m.role === "assistant" ? "AI" : "Ты"}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </motion.div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Почему упал TG verify за 7 дней?" />
                <Button onClick={askAI}><Bot className="mr-1 h-4 w-4" />Спросить</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}


      {section === "metrics_lab" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Метрики (Metrics Lab)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["growth","activation","engagement","content","events","social","safety","ai","health"] as const).map((tab) => (
                  <Button key={tab} size="sm" variant={metricsTab === tab ? "default" : "secondary"} onClick={() => setMetricsTab(tab)}>{tab}</Button>
                ))}
              </div>

              {metricsLab.isLoading ? <Skeleton className="h-60 w-full" /> : null}

              {!metricsLab.isLoading && !(metricsLab.data?.kpis?.length ?? 0) ? (
                <EmptyState title="Метрики Lab пусты" onSeed={seedDemo} onCheck={checkTracking} />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {(metricsLab.data?.kpis ?? []).map((k) => (
                    <div key={k.name} className="rounded-xl border border-border bg-black/10 p-3">
                      <p className="text-xs text-muted">{k.name}</p>
                      <p className="text-xl font-semibold">{typeof k.value === "number" ? k.value : String(k.value)}</p>
                      {k.subtitle ? <p className="text-xs text-muted">{k.subtitle}</p> : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {(metricsLab.data?.trends ?? []).slice(0,2).map((t) => (
                  <TrendChart key={t.key} title={`${metricsTab} / ${t.key}`} points={t.points} />
                ))}
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
              <Button className="w-full" onClick={seedDemo} disabled={isSeedLoading}>{isSeedLoading ? "..." : "Run simulation"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Live Simulation</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                <p>LIVE: <strong>{liveSim.data?.running ? "ON" : "OFF"}</strong></p>
                <p>total events: {liveSim.data?.totalGenerated ?? 0}</p>
                <p>interval: {liveSim.data?.intervalSec ?? simConfig.intervalSec}s</p>
              </div>
              <Input type="number" value={simConfig.intervalSec} onChange={(e) => setSimConfig((s) => ({ ...s, intervalSec: Number(e.target.value) }))} placeholder="interval sec" />
              <Input type="number" value={simConfig.eventsPerTick} onChange={(e) => setSimConfig((s) => ({ ...s, eventsPerTick: Number(e.target.value) }))} placeholder="events per tick" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={async () => { await api("/api/admin/dev/live-simulation", { method: "POST", body: JSON.stringify({ action: "start", intervalSec: simConfig.intervalSec, eventsPerTick: simConfig.eventsPerTick }) }); liveSim.refetch(); }}>Start</Button>
                <Button className="flex-1" variant="secondary" onClick={async () => { await api("/api/admin/dev/live-simulation", { method: "POST", body: JSON.stringify({ action: "stop" }) }); liveSim.refetch(); }}>Stop</Button>
                <Button className="flex-1" variant="secondary" onClick={async () => { await api("/api/admin/dev/live-simulation", { method: "POST", body: JSON.stringify({ action: "tick", eventsPerTick: simConfig.eventsPerTick }) }); liveSim.refetch(); }}>Tick</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "integrations" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Интеграции</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(integrations.data?.items ?? []).map((i) => (
                <div key={i.key} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
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
            <CardHeader><CardTitle>RBAC и сессии</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-xl border border-border bg-black/10 p-3">
                <p>Роли: {Object.entries(security.data?.roleCounts ?? {}).map(([k, v]) => `${k}:${v}`).join(" · ") || "-"}</p>
                <p>Blocked users: {security.data?.blockedUsers ?? 0}</p>
                <p>Active sessions: {security.data?.activeSessions ?? 0}</p>
                <p className="text-xs text-muted">2FA: planned v2 (каркас)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(security.data?.recentAdminActions ?? []).map((a: any) => <p key={a.id}>• {a.action} · {new Date(a.created_at).toLocaleString("ru-RU")}</p>)}
              {!security.data?.recentAdminActions?.length ? <EmptyState title="Нет записей audit" onSeed={seedDemo} onCheck={checkTracking} /> : null}
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
                <div key={item.key} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{item.key}</p>
                  <p className="text-xs text-muted">{JSON.stringify(item.value)}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    variant="secondary"
                    onClick={() => saveSystemSetting(item.key, item.value)}
                  >
                    Сохранить
                  </Button>
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
            <Button onClick={seedDemo} disabled={isSeedLoading}>{isSeedLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}Seed demo data</Button>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
