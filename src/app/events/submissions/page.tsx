"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type SubmissionItem = {
  id: string;
  title: string;
  category: string;
  city: string;
  starts_at: string;
  status: string;
  moderation_status: string;
  created_at: string;
  event_id?: string | null;
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
    case "pending":
    default:
      return "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] text-text2";
  }
}

export default function EventSubmissionsPage() {
  const submissionsQuery = useQuery({
    queryKey: ["event-submissions"],
    queryFn: () => api<{ items: SubmissionItem[] }>("/api/events/submissions/list"),
  });

  const items = submissionsQuery.data?.items ?? [];

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-6">
          <h1 className="text-2xl font-semibold">Мои заявки</h1>
          <p className="mt-2 text-sm text-text2">История отправок на модерацию.</p>
        </div>

        {submissionsQuery.isLoading ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
            <CardContent className="p-4 text-sm text-text2">Загружаем заявки...</CardContent>
          </Card>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{item.title}</p>
                      <p className="text-xs text-text2">{item.category} · {item.city}</p>
                      <p className="text-xs text-text3">Отправлено: {new Date(item.created_at).toLocaleString("ru-RU")}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(item.moderation_status)}`}>
                      {statusLabel(item.moderation_status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.event_id ? (
                      <Link href={`/events/${item.event_id}`} className="inline-flex">
                        <Button variant="secondary" size="sm">Открыть событие</Button>
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
            <CardContent className="p-4 text-sm text-text2">Пока нет заявок. Создай событие и отправь на модерацию.</CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
