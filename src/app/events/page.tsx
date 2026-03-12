"use client";

import { useEffect, useMemo, useState } from "react";
import { InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { EventCard } from "@/components/event-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreateEventDialog } from "@/components/create-event-dialog";
import { api } from "@/lib/api-client";

type EventsResponse = {
  items: Array<{
    id: string;
    title: string;
    description: string;
    outcomes: string[];
    cover_url: string | null;
    event_date: string;
    price: number;
    participants: Array<{ id: string; avatar_url: string | null }>;
    joined?: boolean;
  }>;
  next_offset?: number | null;
  cache?: { mode: "fresh" | "stale"; at: string };
};

const SNAPSHOT_KEY = "events_snapshot_v1";

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{ items: EventsResponse["items"]; ts: number } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { items: EventsResponse["items"]; ts: number };
      setSnapshot(parsed);
    } catch {
      setSnapshot(null);
    }
  }, []);

  const eventsQuery = useInfiniteQuery<EventsResponse>({
    queryKey: ["events"],
    queryFn: ({ pageParam = 0 }) => api<EventsResponse>(`/api/events?limit=20&offset=${pageParam}`),
    getNextPageParam: (lastPage) => (lastPage.next_offset ?? undefined),
    staleTime: 20_000,
    initialPageParam: 0,
  });

  const items = useMemo(() => {
    if (eventsQuery.data?.pages?.length) {
      return eventsQuery.data.pages.flatMap((p) => p.items);
    }
    return snapshot?.items ?? [];
  }, [eventsQuery.data, snapshot]);

  useEffect(() => {
    if (!eventsQuery.data?.pages?.length) return;
    const payload = {
      items: eventsQuery.data.pages.flatMap((p) => p.items),
      ts: Date.now(),
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
    setSnapshot(payload);
  }, [eventsQuery.data]);

  async function join(id: string) {
    setJoiningId(id);
    try {
      await api(`/api/events/${id}/join`, { method: "POST" });
      queryClient.setQueryData<InfiniteData<EventsResponse> | undefined>(["events"], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === id ? { ...item, joined: true } : item)),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } finally {
      setJoiningId(null);
    }
  }

  const cacheInfo = eventsQuery.data?.pages?.[0]?.cache;
  const staleInfo = cacheInfo?.mode === "stale" ? cacheInfo : null;
  const snapshotAgeMin = snapshot ? Math.max(1, Math.round((Date.now() - snapshot.ts) / 60000)) : null;

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Мероприятия</h1>
          <p className="text-xs text-muted">Живые встречи с понятным профитом и подбором людей рядом</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Добавить событие</Button>
      </div>

      {staleInfo ? (
        <div className="mb-3 rounded-2xl border border-border bg-white/5 px-3 py-2 text-xs text-muted">
          Показаны последние доступные данные. Обновлено {new Date(staleInfo.at).toLocaleString("ru-RU")}.
        </div>
      ) : null}

      {!eventsQuery.isLoading && eventsQuery.isError && !items.length ? (
        <div className="rounded-2xl border border-border bg-white/5 px-3 py-3 text-sm">
          <p className="text-sm">Не удалось загрузить события.</p>
          <p className="text-xs text-muted">Проверь соединение и попробуй снова.</p>
          <Button className="mt-2" onClick={() => eventsQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {eventsQuery.isLoading && !items.length ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      ) : (
        <>
          {snapshot && eventsQuery.isError ? (
            <div className="mb-3 rounded-2xl border border-border bg-white/5 px-3 py-2 text-xs text-muted">
              Показан офлайн-снимок. Обновлено {snapshotAgeMin} мин назад.
            </div>
          ) : null}
          <div className="space-y-3">
            {items.map((event) => (
              <EventCard key={event.id} event={event} onJoin={join} joining={joiningId === event.id} />
            ))}
          </div>
          {eventsQuery.hasNextPage ? (
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => eventsQuery.fetchNextPage()}
              disabled={eventsQuery.isFetchingNextPage}
            >
              {eventsQuery.isFetchingNextPage ? "Загружаем..." : "Показать ещё"}
            </Button>
          ) : null}
        </>
      )}

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["events"] });
        }}
      />
    </PageShell>
  );
}
