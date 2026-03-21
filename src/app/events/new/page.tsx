"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, PlusCircle, TrendingUp, Users2, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type OrganizerSummary = {
  totals: {
    submissions: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  events: {
    count: number;
    total_attendees: number;
    by_category: Record<string, number>;
  };
  recent: {
    id: string;
    title: string;
    category: string;
    status: string;
    moderation_status: string;
    created_at: string;
    event_id?: string | null;
  }[];
};

function statusLabel(status?: string) {
  switch (status) {
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    case "clarification_needed":
    case "flagged":
      return "Нужно уточнение";
    case "in_review":
      return "В работе";
    case "pending":
    default:
      return "На модерации";
  }
}

function statusClass(status?: string) {
  switch (status) {
    case "approved":
      return "border-[rgb(var(--teal-rgb)/0.35)] bg-[rgb(var(--teal-rgb)/0.12)] text-text";
    case "rejected":
      return "border-[rgb(var(--danger-rgb)/0.35)] bg-[rgb(var(--danger-rgb)/0.12)] text-[rgb(var(--danger-rgb))]";
    case "clarification_needed":
    case "flagged":
      return "border-[rgb(var(--warning-rgb)/0.35)] bg-[rgb(var(--warning-rgb)/0.12)] text-[rgb(var(--warning-rgb))]";
    case "in_review":
      return "border-[rgb(var(--violet-rgb)/0.35)] bg-[rgb(var(--violet-rgb)/0.12)] text-text";
    case "pending":
    default:
      return "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] text-text2";
  }
}

export default function OrganizerDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["organizer-summary"],
    queryFn: () => api<OrganizerSummary>("/api/events/organizer/summary"),
  });

  const summary = summaryQuery.data;
  const categories = useMemo(() => summary?.events.by_category ?? {}, [summary]);
  const trustScore = useMemo(() => {
    const approved = summary?.totals.approved ?? 0;
    const base = approved > 0 ? 30 : 10;
    return Math.min(100, base + approved * 12);
  }, [summary]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="rounded-[32px] border border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(16,22,48,0.98),rgba(12,18,36,0.94))] p-6 shadow-[0_24px_60px_rgba(10,16,36,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-text">Кабинет организатора</h1>
              <p className="text-sm text-text2">История мероприятий, модерация и статистика.</p>
            </div>
            <Link href="/events/new/create" className="inline-flex">
              <Button className="h-12 rounded-full px-6 text-sm font-semibold shadow-[0_12px_24px_rgba(122,84,255,0.35)]">
                <PlusCircle className="mr-2 h-4 w-4" /> Создать событие
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-4">
              <p className="text-xs text-text3">Всего заявок</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary?.totals.submissions ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-4">
              <p className="text-xs text-text3">На модерации</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary?.totals.pending ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-4">
              <p className="text-xs text-text3">Одобрено</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary?.totals.approved ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-4">
              <p className="text-xs text-text3">Отклонено</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary?.totals.rejected ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-4">
              <div className="flex items-center justify-between text-xs text-text2">
                <span>Уровень доверия организатора</span>
                <span>{trustScore}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-3-rgb)/0.9)]">
                <div className="h-full rounded-full bg-[image:var(--grad-primary)]" style={{ width: `${trustScore}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-text3">Одобренные события повышают доверие и скорость модерации.</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-4">
              <div className="flex items-start gap-2 text-xs text-text2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[rgb(var(--violet-rgb))]" />
                <div>
                  <p className="text-sm font-semibold text-text">Как проходит модерация</p>
                  <p className="mt-1">Новая заявка → В работе → Одобрено или Уточнение. Статус виден в истории.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">История заявок</p>
                  <p className="text-xs text-text2">Последние отправки на модерацию.</p>
                </div>
                <Link href="/events/submissions" className="text-xs text-[rgb(var(--sky-rgb))]">Все заявки</Link>
              </div>
              {summaryQuery.isLoading ? (
                <div className="text-sm text-text2">Загружаем...</div>
              ) : summary?.recent?.length ? (
                <div className="space-y-2">
                  {summary.recent.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text">{item.title}</p>
                          <p className="text-xs text-text2">{item.category} · {new Date(item.created_at).toLocaleDateString("ru-RU")}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(item.moderation_status)}`}>{statusLabel(item.moderation_status)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-text3">
                        <span>Статус: {statusLabel(item.moderation_status)}</span>
                        {item.event_id ? (
                          <Link href={`/events/${item.event_id}`} className="text-[rgb(var(--sky-rgb))]">Открыть событие</Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text2">Пока нет заявок. Создай событие и отправь на модерацию.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-sm font-semibold text-text">Статистика организатора</p>
                <p className="text-xs text-text2">Общий вклад и аудитория твоих событий.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                  <p className="text-xs text-text3">Всего событий</p>
                  <p className="mt-2 text-xl font-semibold text-text">{summary?.events.count ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                  <p className="text-xs text-text3">Всего участников</p>
                  <p className="mt-2 text-xl font-semibold text-text">{summary?.events.total_attendees ?? 0}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text3">Событий по категориям</p>
                  <TrendingUp className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
                </div>
                <div className="mt-2 space-y-2 text-xs text-text2">
                  {Object.keys(categories).length ? (
                    Object.entries(categories).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="capitalize">{key}</span>
                        <span className="text-text">{value}</span>
                      </div>
                    ))
                  ) : (
                    <p>Пока нет данных.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3 text-xs text-text2">
                <div className="flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-[rgb(var(--violet-rgb))]" />
                  Чем больше одобренных событий, тем выше доверие организатора.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm text-text2">
              <CalendarDays className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
              Запланируй события заранее — это повышает конверсию заявок.
            </div>
            <Link href="/events">
              <Button variant="secondary" className="h-11">К афише</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
