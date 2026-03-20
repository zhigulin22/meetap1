"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { EventCard } from "@/components/event-card";
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

  const { data, isLoading } = useQuery({
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
          items: prev.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  joined: true,
                }
              : item,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <PageShell>
      <div className="mb-3">
        <h1 className="text-2xl font-semibold">Мероприятия</h1>
        <p className="text-xs text-muted">Живые встречи с понятным профитом и подбором людей рядом</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((event) => (
            <EventCard key={event.id} event={event} onJoin={join} joining={joiningId === event.id} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
