"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, Beaker, Bot, Flag, Shield, SlidersHorizontal, Users } from "lucide-react";
import { AdminShell, type AdminSection } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  usersTotal: "Пользователи (Users)",
  dau: "Дневная аудитория (DAU)",
  wau: "Недельная аудитория (WAU)",
  mau: "Месячная аудитория (MAU)",
  dauMau: "Липкость (DAU/MAU)",
  newUsers1d: "Новые за день (New Users 1d)",
  newUsers7d: "Новые за 7 дней (New Users 7d)",
  telegramVerifiedRate: "Верификация Telegram (TG Verify Rate)",
  registrationCompletedRate: "Завершение регистрации (Registration Rate)",
  verifiedUsers: "Верифицированные (Verified)",
  dailyDuo1d: "Daily Duo за день",
  dailyDuo7d: "Daily Duo за 7 дней",
  videoPosts1d: "Видео за день (Posts Video 1d)",
  videoPosts7d: "Видео за 7 дней (Posts Video 7d)",
  eventJoin1d: "Join ивентов за день",
  eventJoin7d: "Join ивентов за 7 дней",
  connectClicked: "Отправленные коннекты (Connect Sent)",
  chatsStarted: "Старт чатов (Chats Started)",
  wmc: "Содержательные диалоги за неделю (WMC)",
  reportsOpen: "Открытые жалобы (Reports)",
  flagsOpen: "Открытые AI-флаги (Flags)",
  blockedUsers: "Заблокированные (Blocked)",
  apiErrors1d: "Ошибки API за день",
  aiCalls7d: "AI вызовы за 7 дней",
  aiCostUsd7d: "Затраты AI за 7 дней ($)",
};

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

  const toISO = new Date().toISOString();
  const fromISO = useMemo(() => {
    const days = Number(dateRange.replace("d", ""));
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [dateRange]);

  const overview = useQuery({
    queryKey: ["admin-overview-v4", fromISO, toISO, segment],
    queryFn: () => adminApi(`/api/admin/metrics/overview?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`, overviewResponseSchema),
  });

  const funnels = useQuery({
    queryKey: ["admin-funnels-v4", fromISO, toISO, segment],
    queryFn: () => adminApi(`/api/admin/metrics/funnels?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&segment=${segment}`, funnelsResponseSchema),
  });

  const retention = useQuery({
    queryKey: ["admin-retention-v4", segment],
    queryFn: () => adminApi(`/api/admin/metrics/retention?from=${encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())}&to=${encodeURIComponent(toISO)}&segment=${segment}`, retentionResponseSchema),
  });

  const users = useQuery({
    queryKey: ["admin-users-v4", userSearch],
    queryFn: () => adminApi(`/api/admin/users/search?q=${encodeURIComponent(userSearch)}&limit=50`, userSearchResponseSchema),
  });

  const moderation = useQuery({
    queryKey: ["admin-moderation-v4"],
    queryFn: () => adminApi("/api/admin/moderation/actions", moderationQueueResponseSchema),
  });

  const flags = useQuery({
    queryKey: ["admin-flags-v4"],
    queryFn: () => adminApi("/api/admin/feature-flags", featureFlagsResponseSchema),
  });

  const experiments = useQuery({
    queryKey: ["admin-experiments-v2"],
    queryFn: () => api<{ items: any[] }>("/api/admin/experiments"),
  });

  const alerts = useQuery({
    queryKey: ["admin-alerts-v2"],
    queryFn: () => api<{ items: any[] }>("/api/admin/alerts"),
  });

  const risk = useQuery({
    queryKey: ["admin-risk-v2"],
    queryFn: () => api<{ items: any[] }>("/api/admin/risk"),
  });

  const reports = useQuery({
    queryKey: ["admin-reports-v2"],
    queryFn: () => api<{ items: any[] }>("/api/admin/reports"),
  });

  async function moderate(action: any) {
    try {
      await api("/api/admin/moderation/actions", { method: "POST", body: JSON.stringify({ ...action, reason: moderationReason }) });
      toast.success("Действие применено");
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-v4"] });
      queryClient.invalidateQueries({ queryKey: ["admin-risk-v2"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports-v2"] });
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
            funnels: funnels.data?.steps,
            retention: retention.data?.cohorts,
            alerts: alerts.data?.items,
            risk: risk.data?.items?.slice(0, 20),
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
          {Object.entries(overview.data?.overview ?? {}).map(([k, v], idx) => (
            <motion.div key={k} className="col-span-12 sm:col-span-6 xl:col-span-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.01 }}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">{labels[k] ?? k}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {typeof v === "number" ? (k.toLowerCase().includes("rate") || k === "dauMau" ? `${Math.round(v * 100)}%` : v) : String(v)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </>
      ) : null}

      {section === "funnels" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Воронка продукта</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(funnels.data?.steps ?? []).map((step) => (
                <div key={step.step} className="rounded-xl border border-border bg-black/10 p-3">
                  <div className="flex items-center justify-between text-sm"><p>{step.step}</p><p>{step.count}</p></div>
                  <p className="text-xs text-muted">Drop: {Math.round(step.drop * 100)}% · Conv from start: {Math.round(step.conversionFromStart * 100)}%</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "retention" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Когорты удержания (D1/D7/D30)</CardTitle></CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
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
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "experiments" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Эксперименты (A/B)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(experiments.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{x.key}</p>
                  <p className="text-xs text-muted">status: {x.status} · rollout: {x.rollout_percent}% · metric: {x.primary_metric}</p>
                </div>
              ))}
              {!experiments.data?.items?.length ? <p className="text-sm text-muted">Экспериментов пока нет.</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "flags" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Feature Flags / Remote Config</CardTitle></CardHeader>
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
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "alerts" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Алерты и аномалии</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(alerts.data?.items ?? []).map((x) => (
                <div key={x.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{x.metric}</p>
                  <p className="text-xs text-muted">{x.type} · threshold {x.threshold} · window {x.window} · {x.status}</p>
                </div>
              ))}
              {!alerts.data?.items?.length ? <p className="text-sm text-muted">Алертов пока нет.</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "users" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Users 360</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Поиск по имени/номеру" />
              {(users.data?.items ?? []).map((u) => (
                <div key={u.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted">{u.phone} · {u.role}</p>
                    </div>
                    <div className="text-xs text-muted">flags {u.openFlags} · reports {u.openReports}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "risk" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Risk Center</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(risk.data?.items ?? []).slice(0, 50).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">risk {r.risk_score} · {r.risk_status}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => moderate({ targetType: "user", targetId: r.id, action: "shadowban" })}>Shadowban</Button>
                    <Button size="sm" variant="danger" onClick={() => moderate({ targetType: "user", targetId: r.id, action: "block_user" })}>Block</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "reports" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Reports Inbox</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(reports.data?.items ?? []).slice(0, 100).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-black/10 p-3 text-sm">
                  <p className="font-medium">{r.content_type} · {r.reason}</p>
                  <p className="text-xs text-muted">{r.status}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => api("/api/admin/reports", { method: "PUT", body: JSON.stringify({ id: r.id, status: "resolved" }) }).then(() => reports.refetch())}>Resolve</Button>
                  </div>
                </div>
              ))}
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
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "assistant" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>AI Ассистент админки</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-black/10 p-3">
                {!aiLog.length ? <p className="text-xs text-muted">Спроси: где провал в воронке, почему упал TG verify, что влияет на WMC.</p> : null}
                {aiLog.map((m, i) => (
                  <motion.div key={`${m.role}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-3 text-sm ${m.role === "assistant" ? "border-cyan/30 bg-[#143053]/50" : "border-border bg-black/20"}`}>
                    <p className="mb-1 text-xs text-muted">{m.role === "assistant" ? "AI" : "Ты"}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </motion.div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Почему упала верификация Telegram за 7 дней?" />
                <Button onClick={askAI}><Bot className="mr-1 h-4 w-4" />Спросить</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="col-span-12">
        <Card>
          <CardHeader><CardTitle>Быстрые действия</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSection("overview")}><SlidersHorizontal className="mr-1 h-4 w-4" />Метрики</Button>
            <Button variant="secondary" onClick={() => setSection("users")}><Users className="mr-1 h-4 w-4" />Users 360</Button>
            <Button variant="secondary" onClick={() => setSection("moderation")}><Shield className="mr-1 h-4 w-4" />Модерация</Button>
            <Button variant="secondary" onClick={() => setSection("flags")}><Flag className="mr-1 h-4 w-4" />Feature Flags</Button>
            <Button variant="secondary" onClick={() => setSection("experiments")}><Beaker className="mr-1 h-4 w-4" />A/B</Button>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
