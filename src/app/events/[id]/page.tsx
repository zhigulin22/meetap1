"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [loadingJoin, setLoadingJoin] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["event", params.id],
    queryFn: () => api<{ event: any; participants: any[]; joined?: boolean }>(`/api/events/${params.id}`),
  });

  async function join() {
    setLoadingJoin(true);
    try {
      await api(`/api/events/${params.id}/join`, { method: "POST" });
      queryClient.setQueryData<{ event: any; participants: any[]; joined?: boolean } | undefined>(
        ["event", params.id],
        (prev) => (prev ? { ...prev, joined: true } : prev),
      );
      queryClient.invalidateQueries({ queryKey: ["event", params.id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } finally {
      setLoadingJoin(false);
    }
  }

  async function find3() {
    const res = await api<{ items: Array<{ id: string; name: string; common: string[] }> }>(
      `/api/events/${params.id}/find-3`,
      { method: "POST" },
    );
    queryClient.setQueryData<any>(["find3", params.id], res.items);
  }

  const suggested = queryClient.getQueryData<Array<{ id: string; name: string; common: string[] }>>([
    "find3",
    params.id,
  ]);

  if (isLoading || !data) {
    return (
      <PageShell>
        <Skeleton className="h-[74vh] w-full rounded-3xl" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="overflow-hidden">
        <Image
          src={data.event.cover_url || "https://placehold.co/1200x700"}
          alt={data.event.title}
          width={1200}
          height={700}
          className="h-52 w-full object-cover"
          unoptimized
        />

        <CardContent className="space-y-4 p-4">
          <h1 className="text-2xl font-semibold">{data.event.title}</h1>
          <p className="text-sm text-muted">
            {new Date(data.event.event_date).toLocaleString("ru-RU")} · {data.event.price === 0 ? "Бесплатно" : `${data.event.price} ₽`}
          </p>
          <p>{data.event.description}</p>

          <div className="space-y-1">
            <p className="text-sm font-medium">Что получите:</p>
            {data.event.outcomes?.map((o: string) => (
              <p key={o} className="text-sm text-muted">• {o}</p>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {data.joined ? (
              <div className="col-span-1 flex h-11 items-center justify-center rounded-2xl border border-[#52cc83]/50 bg-[#52cc83]/15 text-sm font-semibold text-[#52cc83]">
                Регистрация успешна
              </div>
            ) : (
              <Button onClick={join} disabled={loadingJoin}>
                {loadingJoin ? "..." : "Я иду"}
              </Button>
            )}
            <Button variant="secondary" onClick={find3}>
              Найти 3 человека
            </Button>
          </div>

          {suggested?.length ? (
            <div className="rounded-2xl border border-border bg-black/20 p-3">
              <p className="mb-2 text-sm font-medium">Кого лучше поймать на событии:</p>
              {suggested.map((person) => (
                <Link key={person.id} href={`/profile/${person.id}`} className="block text-sm text-muted hover:text-text">
                  • {person.name} {person.common.length ? `— ${person.common.join(", ")}` : ""}
                </Link>
              ))}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">Участники</p>
            <div className="space-y-2">
              {data.participants.map((p: any) => {
                const user = Array.isArray(p.users) ? p.users[0] : p.users;
                if (!user) return null;
                return (
                  <Link key={user.id} href={`/profile/${user.id}`} className="flex items-center gap-2 text-sm text-muted hover:text-text">
                    <Image
                      src={user.avatar_url || "https://placehold.co/100"}
                      alt={user.name}
                      width={100}
                      height={100}
                      className="h-8 w-8 rounded-full object-cover"
                      unoptimized
                    />
                    {user.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-black/10 p-3 text-sm text-muted">
            Чат события (MVP): структура готова, подключим realtime на следующем шаге.
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
