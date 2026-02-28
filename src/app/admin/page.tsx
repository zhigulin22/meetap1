"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Play, Square, Gauge, Users, ShieldAlert, Activity, Trash2 } from "lucide-react";
import { AdminShell, type AdminSection } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/admin-client";
import {
  adminHealthResponseSchema,
  liveEventsResponseSchema,
  metricsSummaryResponseSchema,
  userSearchResponseSchema,
} from "@/lib/admin-schemas";
import { api, ApiClientError } from "@/lib/api-client";

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
  growth: [
    "users_total",
    "users_new_24h",
    "users_new_7d",
    "users_new_30d",
    "registration_completion_rate",
    "tg_verify_rate",
    "activation_rate",
    "profile_completed_rate",
  ],
  activation: [
    "profile_completed_rate",
    "facts_filled_rate",
    "avatar_rate",
    "psychotest_completed_rate",
    "avg_interests_count",
  ],
  engagement: [
    "events_total_24h",
    "events_total_7d",
    "events_total_30d",
    "active_users_24h",
    "active_users_7d",
    "active_users_30d",
    "sessions_24h",
    "dau_proxy",
    "wau_proxy",
  ],
  content: [
    "posts_duo_24h",
    "posts_duo_7d",
    "posts_duo_30d",
    "posts_video_24h",
    "posts_video_7d",
    "posts_video_30d",
    "comments_24h",
    "comments_7d",
    "comments_30d",
    "posters_7d",
  ],
  events: [
    "event_viewed_24h",
    "event_viewed_7d",
    "event_viewed_30d",
    "event_joined_24h",
    "event_joined_7d",
    "event_joined_30d",
    "join_rate",
  ],
  social: [
    "connect_sent_24h",
    "connect_sent_7d",
    "connect_sent_30d",
    "connect_replied_24h",
    "connect_replied_7d",
    "connect_replied_30d",
    "reply_rate",
    "messages_sent_24h",
    "messages_sent_7d",
    "messages_sent_30d",
    "continued_chats_proxy_30d",
  ],
  safety: [
    "shadow_banned_count",
    "message_limited_count",
    "reports_count_24h",
    "reports_count_7d",
    "reports_count_30d",
    "risk_users_count",
    "deleted_users_30d",
  ],
  ai: [
    "ai_cost_total_24h",
    "ai_cost_total_7d",
    "ai_cost_total_30d",
    "ai_calls_24h",
    "ai_error_rate",
  ],
  health: [
    "events_total_24h",
    "events_total_7d",
    "events_total_30d",
    "active_users_24h",
    "users_total",
  ],
};

function formatKpi(key: string, value: number) {
  if (!Number.isFinite(value)) return "0";
  if (key.includes("_rate") || key.includes("rate")) return `${(value * 100).toFixed(1)}%`;
  if (key.includes("cost")) return `$${value.toFixed(4)}`;
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("ru-RU");
  if (Number.isInteger(value)) return value.toLocaleString("ru-RU");
  return value.toFixed(3);
}

function KpiGrid({ kpis, keys }: { kpis: Record<string, number>; keys?: string[] }) {
  const entries = (keys?.length ? keys.map((k) => [k, kpis[k] ?? 0] as const) : Object.entries(kpis)).filter(([, v]) => typeof v === "number");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([k, v]) => (
        <Card key={k}>
          <CardContent className="p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-xl font-semibold text-text">{formatKpi(k, Number(v))}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-border bg-surface2/70 p-3 text-sm text-muted">{text}</p>;
}

export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>("overview");
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [segment, setSegment] = useState<"all" | "verified" | "new" | "active">("all");
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

  const [trafficForm, setTrafficForm] = useState({ users_count: 30, interval_sec: 8, intensity: "normal" as "low" | "normal" | "high", chaos: true });
  const [trafficAction, setTrafficAction] = useState<null | "start" | "stop" | "tick" | "reset">(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficLastTick, setTrafficLastTick] = useState<{ events_written: number; last_db_event_at: string | null } | null>(null);

  const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 90;

  const health = useQuery({
    queryKey: ["admin-health-v1"],
    queryFn: () => adminApi("/api/admin/health", adminHealthResponseSchema),
    retry: false,
    refetchInterval: 15000,
  });

  const healthOk = health.data?.ok === true;

  const summary = useQuery({
    queryKey: ["admin-summary-v1", days, segment],
    queryFn: () => adminApi(`/api/admin/metrics/summary?days=${days}&segment=${segment}`, metricsSummaryResponseSchema),
    enabled: healthOk,
    refetchInterval: section === "traffic" ? 8000 : 15000,
  });

  const users = useQuery({
    queryKey: ["admin-users-v6", userFilter],
    queryFn: () =>
      adminApi(
        `/api/admin/users/search?q=${encodeURIComponent(userFilter.q)}&limit=50&demo=${userFilter.demo}&role=${encodeURIComponent(userFilter.role)}&shadow_banned=${userFilter.shadow_banned}&message_limited=${userFilter.message_limited}&profile_completed=${userFilter.profile_completed}&city=${encodeURIComponent(userFilter.city)}`,
        userSearchResponseSchema,
      ),
    enabled: healthOk,
  });

  const liveEvents = useQuery({
    queryKey: ["admin-events-live-v1", eventsFilter],
    queryFn: () =>
      adminApi(
        `/api/admin/events/live?event_name=${encodeURIComponent(eventsFilter.eventName)}&user_id=${encodeURIComponent(eventsFilter.userId)}&demo_group=${encodeURIComponent(eventsFilter.demoGroup)}&limit=500`,
        liveEventsResponseSchema,
      ),
    enabled: healthOk,
    refetchInterval: section === "events_live" ? 4000 : false,
  });

  const trafficStatus = useQuery({
    queryKey: ["admin-traffic-status-v2"],
    queryFn: () => api<any>("/api/admin/traffic/status"),
    enabled: healthOk,
    refetchInterval: section === "traffic" ? 4000 : false,
  });

  const trafficProof = useQuery({
    queryKey: ["admin-traffic-proof-v2"],
    queryFn: () => api<{ events_last_window: number; last_event_at: string | null }>("/api/admin/traffic/proof?minutes=2"),
    enabled: healthOk,
    refetchInterval: section === "traffic" ? 4000 : false,
  });

  const activeErrors = [health.error, summary.error, users.error, liveEvents.error, trafficStatus.error, trafficProof.error]
    .filter(Boolean)
    .map((e) => {
      if (e instanceof ApiClientError) {
        if (e.code === "FORBIDDEN" || e.code === "UNAUTHORIZED") {
          return `Нет прав на ${e.endpoint}. Проверь роль пользователя (admin/moderator/analyst/support).`;
        }
        if (e.code === "MISSING_ENV") {
          return `Сервер не настроен: ${e.hint ?? "добавь SERVICE_ROLE ключ и redeploy"}.`;
        }
        if (e.code === "RLS") {
          return `Серверный доступ к БД ограничен: ${e.hint ?? "проверь SERVICE_ROLE и политики"}.`;
        }
        return `${e.endpoint}: ${e.message.replace(/\[[A-Z_]+\]\s*/g, "")}`;
      }
      return e instanceof Error ? e.message : "Request failed";
    });

  const onTrafficStart = async () => {
    try {
      setTrafficAction("start");
      setTrafficError(null);
      const startRes = await api<{ run_id?: string }>("/api/admin/traffic/start", { method: "POST", body: JSON.stringify(trafficForm) });
      await api<{ events_written: number; last_db_event_at: string | null }>("/api/admin/traffic/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: startRes?.run_id ?? null }),
      });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), liveEvents.refetch(), users.refetch()]);
      setSection("traffic");
    } catch (e) {
      setTrafficError(e instanceof Error ? e.message : "Не удалось запустить traffic");
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficStop = async () => {
    try {
      setTrafficAction("stop");
      setTrafficError(null);
      await api("/api/admin/traffic/stop", { method: "POST", body: JSON.stringify({ run_id: trafficStatus.data?.run?.id ?? null }) });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch()]);
    } catch (e) {
      setTrafficError(e instanceof Error ? e.message : "Не удалось остановить traffic");
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficTick = async () => {
    try {
      setTrafficAction("tick");
      setTrafficError(null);
      const res = await api<{ events_written: number; last_db_event_at: string | null }>("/api/admin/traffic/tick", {
        method: "POST",
        body: JSON.stringify({ run_id: trafficStatus.data?.run?.id ?? null }),
      });
      setTrafficLastTick(res);
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), liveEvents.refetch(), users.refetch()]);
    } catch (e) {
      setTrafficError(e instanceof Error ? e.message : "Не удалось выполнить tick");
    } finally {
      setTrafficAction(null);
    }
  };

  const onTrafficReset = async () => {
    try {
      setTrafficAction("reset");
      setTrafficError(null);
      await api("/api/admin/traffic/reset", { method: "POST" });
      await Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), users.refetch(), liveEvents.refetch()]);
    } catch (e) {
      setTrafficError(e instanceof Error ? e.message : "Не удалось очистить demo");
    } finally {
      setTrafficAction(null);
    }
  };

  useEffect(() => {
    if (section !== "traffic") return;
    if (!["RUNNING", "STARTING", "DEGRADED"].includes(String(trafficStatus.data?.runtime_status ?? ""))) return;
    const runId = trafficStatus.data?.run?.id;
    if (!runId) return;

    const intervalMs = Math.max(3000, Math.min(15000, Number(trafficStatus.data?.run?.interval_sec ?? 8) * 1000));
    const timer = window.setInterval(() => {
      void api("/api/admin/traffic/tick", { method: "POST", body: JSON.stringify({ run_id: runId }) })
        .then((res: any) => setTrafficLastTick({ events_written: Number(res.events_written ?? 0), last_db_event_at: res.last_db_event_at ?? null }))
        .then(() => Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch()]))
        .catch(() => undefined);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [section, trafficStatus.data?.runtime_status, trafficStatus.data?.run?.id, trafficStatus.data?.run?.interval_sec]);

  const runActions = async (userId: string, action: string) => {
    try {
      await api(`/api/admin/users/${userId}/actions`, { method: "POST", body: JSON.stringify({ action }) });
      await users.refetch();
      await summary.refetch();
    } catch {
      // error rendered by query/error banner on next refetch
    }
  };

  const metricsKeys = KPI_GROUPS[metricsTab] ?? [];
  const kpis = summary.data?.kpis ?? {};

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
    >
      {!healthOk ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Не подключено: Admin Health Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {health.isLoading ? (
                <p className="inline-flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Проверяю окружение и БД…</p>
              ) : (
                <>
                  {health.data ? (
                    <>
                      <p>Статус БД: <strong>{health.data.db.connected ? "OK" : "ERROR"}</strong></p>
                      <p>ENV: URL={String(health.data.env.NEXT_PUBLIC_SUPABASE_URL)} · ANON={String(health.data.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} · SERVICE={String(health.data.env.SUPABASE_SERVICE_ROLE_KEY)}</p>
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
                  {health.error ? <p className="text-danger">{health.error instanceof Error ? health.error.message : "Health request failed"}</p> : null}
                  <Button variant="secondary" onClick={() => health.refetch()}><RefreshCw className="mr-1 h-4 w-4" />Повторить проверку</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && activeErrors.length ? (
        <div className="col-span-12">
          <Card className="border-warning/30 bg-warning/10">
            <CardHeader><CardTitle>Проблемы загрузки данных</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {activeErrors.slice(0, 6).map((x) => <p key={x}>• {x}</p>)}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "overview" ? (
        <>
          <div className="col-span-12">
            <Card>
              <CardHeader><CardTitle>Overview · KPI в цифрах</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {summary.isLoading ? <p className="text-sm text-muted">Загрузка метрик…</p> : <KpiGrid kpis={kpis} />}
                {summary.data?.warnings?.length ? (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    {summary.data.warnings.map((w) => <p key={w}>• {w}</p>)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top events 24h</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(summary.data?.tables.top_events_24h ?? []).length ? (
                  summary.data?.tables.top_events_24h.map((r) => <p key={r.event_name} className="flex justify-between"><span>{r.event_name}</span><strong>{r.count}</strong></p>)
                ) : <EmptyNote text="Нет событий за 24ч" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(summary.data?.funnel.steps ?? []).length ? (
                  summary.data?.funnel.steps.map((r) => (
                    <p key={r.step} className="flex justify-between"><span>{r.step}</span><strong>{r.users} · {(r.conversion * 100).toFixed(1)}%</strong></p>
                  ))
                ) : <EmptyNote text="Нет данных funnel за период" />}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {healthOk && section === "metrics_lab" ? (
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

              {summary.isLoading ? <p className="text-sm text-muted">Загрузка метрик…</p> : <KpiGrid kpis={kpis} keys={metricsKeys} />}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Breakdown by day</CardTitle></CardHeader>
              <CardContent className="max-h-[380px] space-y-1 overflow-auto text-sm">
                {(summary.data?.tables.breakdown_by_day ?? []).length ? (
                  summary.data?.tables.breakdown_by_day.map((r) => (
                    <p key={r.day} className="grid grid-cols-[120px_1fr] gap-2">
                      <span>{r.day}</span>
                      <span className="text-muted">events:{r.events} · users:{r.active_users} · posts:{r.posts} · joins:{r.joins} · connect:{r.connect_sent}/{r.connect_replied}</span>
                    </p>
                  ))
                ) : <EmptyNote text="Недостаточно данных за период" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top users 30d</CardTitle></CardHeader>
              <CardContent className="max-h-[380px] space-y-1 overflow-auto text-sm">
                {(summary.data?.tables.top_users_30d ?? []).length ? (
                  summary.data?.tables.top_users_30d.map((r) => (
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

      {healthOk && section === "funnels" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Funnels Table</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(summary.data?.funnel.steps ?? []).length ? (
                summary.data?.funnel.steps.map((r) => (
                  <p key={r.step} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2">
                    <span>{r.step}</span>
                    <span className="text-right">{r.users}</span>
                    <span className="text-right">{(r.conversion * 100).toFixed(1)}%</span>
                    <span className="text-right">{(r.dropoff * 100).toFixed(1)}%</span>
                  </p>
                ))
              ) : <EmptyNote text="Нет событий funnel за период. Проверь Events Stream или запусти Traffic." />}
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
                ) : <EmptyNote text="Событий нет по текущим фильтрам" />}
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
                <Input type="number" value={trafficForm.users_count} onChange={(e) => setTrafficForm((p) => ({ ...p, users_count: Number(e.target.value || 30) }))} />
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
                <Button onClick={onTrafficStart} disabled={trafficAction !== null}>{trafficAction === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start</Button>
                <Button variant="secondary" onClick={onTrafficStop} disabled={trafficAction !== null}>{trafficAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Stop</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onTrafficTick} disabled={trafficAction !== null}>{trafficAction === "tick" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Gauge className="mr-1 h-4 w-4" />} Tick</Button>
                <Button variant="secondary" onClick={onTrafficReset} disabled={trafficAction !== null}>{trafficAction === "reset" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Очистить демо</Button>
                <Button variant="secondary" onClick={() => Promise.all([trafficStatus.refetch(), trafficProof.refetch(), summary.refetch(), liveEvents.refetch()])}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
              </div>

              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p>Status: <strong>{trafficStatus.data?.runtime_status ?? "STOPPED"}</strong></p>
                <p>Total events: <strong>{trafficStatus.data?.total_events ?? 0}</strong></p>
                <p>DB events last 2m: <strong>{trafficProof.data?.events_last_window ?? 0}</strong></p>
                <p>Last event: <strong>{trafficProof.data?.last_event_at ? new Date(trafficProof.data.last_event_at).toLocaleString("ru-RU") : "—"}</strong></p>
                <p>Last tick: <strong>{trafficLastTick ? `${trafficLastTick.events_written} @ ${trafficLastTick.last_db_event_at ?? "—"}` : "—"}</strong></p>
              </div>

              {trafficProof.data && trafficStatus.data?.runtime_status === "RUNNING" && (trafficProof.data.events_last_window ?? 0) === 0 ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-danger">RUNNING (NO DB EVENTS). Проверь tick/status и diagnostics.</div>
              ) : null}
              {trafficError ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-danger">{trafficError}</div> : null}

              <div className="rounded-xl border border-border bg-surface2/70 p-3">
                <p className="mb-1 font-medium">Recent events</p>
                {(trafficStatus.data?.sample_events ?? []).length ? (
                  (trafficStatus.data?.sample_events ?? []).map((r: any, idx: number) => (
                    <p key={`${r.event_name}-${idx}`} className="text-xs text-muted">• {r.event_name} · {r.user_id ?? "—"} · {new Date(r.created_at).toLocaleString("ru-RU")}</p>
                  ))
                ) : <p className="text-xs text-muted">Событий пока нет.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "users" ? (
        <div className="col-span-12 space-y-4">
          <Card>
            <CardHeader><CardTitle>Users 360</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
                <Input placeholder="email/username/телефон" value={userFilter.q} onChange={(e) => setUserFilter((p) => ({ ...p, q: e.target.value }))} />
                <select className="admin-select" value={userFilter.demo} onChange={(e) => setUserFilter((p) => ({ ...p, demo: e.target.value as any }))}>
                  <option value="all">all</option>
                  <option value="demo">demo</option>
                  <option value="real">real</option>
                  <option value="traffic">traffic</option>
                </select>
                <Input placeholder="role" value={userFilter.role} onChange={(e) => setUserFilter((p) => ({ ...p, role: e.target.value || "all" }))} />
                <Input placeholder="city" value={userFilter.city} onChange={(e) => setUserFilter((p) => ({ ...p, city: e.target.value }))} />
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
                        <p>flags:{u.openFlags} · reports:{u.openReports} · risk:{u.risk_score ?? 0}</p>
                        <p>status: {u.status}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => runActions(u.id, u.message_limited ? "unlimit_messaging" : "limit_messaging")}>{u.message_limited ? "unlimit" : "limit"}</Button>
                        <Button size="sm" variant="secondary" onClick={() => runActions(u.id, u.shadow_banned ? "unshadowban" : "shadowban")}>{u.shadow_banned ? "unshadow" : "shadow"}</Button>
                        <Button size="sm" variant={u.is_blocked ? "secondary" : "danger"} onClick={() => runActions(u.id, u.is_blocked ? "unblock" : "block")}>{u.is_blocked ? "unblock" : "block"}</Button>
                      </div>
                    </div>
                  ))
                ) : <EmptyNote text="Пользователи не найдены" />}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && section === "risk" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Risk Center</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(summary.data?.tables.risk_top ?? []).length ? (
                summary.data?.tables.risk_top.map((r) => (
                  <p key={r.user_id} className="grid grid-cols-[140px_80px_1fr] gap-2">
                    <span className="font-mono text-xs">{r.user_id.slice(0, 8)}</span>
                    <span>{r.risk_score}</span>
                    <span className="text-muted">{r.signals.join(", ") || "—"}</span>
                  </p>
                ))
              ) : <EmptyNote text="Risk signals не найдены за период" />}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {healthOk && ["reports", "moderation", "alerts", "experiments", "flags", "retention", "assistant", "system", "integrations", "security", "backup"].includes(section) ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Раздел: {section}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted">Этот раздел подключен к новой модели KPI/таблиц. Основные данные доступны в Overview / Metrics Lab / Users / Events Stream / Traffic.</p>
              <Button variant="secondary" onClick={() => setSection("overview")}><Activity className="mr-1 h-4 w-4" />Перейти в обзор</Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
}
