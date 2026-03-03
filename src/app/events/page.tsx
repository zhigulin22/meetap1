"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { PageShell } from "@/components/page-shell";
import { TopBar } from "@/components/top-bar";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
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
};

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => api<EventsResponse>("/api/events"),
  });

  async function join(id: string) {
    setJoiningId(id);
    try {
      await api(`/api/events/${id}/join`, { method: "POST" });
      queryClient.setQueryData<EventsResponse | undefined>(["events"], (prev) => {
        if (!prev) return prev;
        return {
          items: prev.items.map((item) => (item.id === id ? { ...item, joined: true } : item)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <PageShell>
      <TopBar
        title="Ивенты"
        subtitle="Встречи и активности рядом: base-палитра + gold только на специальных CTA"
        right={<Pill tone="gold">EVENTS</Pill>}
      />

      <div className="mb-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[rgb(var(--event-surface-rgb)/0.42)] p-3">
        <p className="inline-flex items-center gap-1 text-xs text-[rgb(var(--ivory-rgb)/0.86)]">
          <CalendarDays className="h-3.5 w-3.5 text-gold" /> Event mode: gold-акценты применяются только для меток и кнопки «Пойти».
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-3">
          {data.items.map((event) => (
            <EventCard key={event.id} event={event} onJoin={join} joining={joiningId === event.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Пока нет активных ивентов"
          description="В твоем сегменте сейчас нет опубликованных встреч."
          hint="Попробуй обновить экран или выбрать другой момент времени."
          cta={{ label: "Обновить", onClick: () => refetch() }}
        />
      )}
    </PageShell>
  );
}
