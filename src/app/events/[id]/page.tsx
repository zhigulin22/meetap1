"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [endorsedIds, setEndorsedIds] = useState<string[]>([]);
  const [endorseLoadingId, setEndorseLoadingId] = useState<string | null>(null);
  const [endorseSearch, setEndorseSearch] = useState("");

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

  async function endorse(toUserId: string) {
    if (endorsedIds.includes(toUserId)) return;
    try {
      setEndorseLoadingId(toUserId);
      await api(`/api/events/${params.id}/endorse`, { method: "POST", body: JSON.stringify({ toUserId }) });
      setEndorsedIds((prev) => [...prev, toUserId]);
      toast.success("Отметка отправлена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить отметку");
    } finally {
      setEndorseLoadingId(null);
    }
  }

  const suggested = queryClient.getQueryData<Array<{ id: string; name: string; common: string[] }>>([
    "find3",
    params.id,
  ]);

  const filteredParticipants = useMemo(() => {
    if (!data?.participants) return [];
    const q = endorseSearch.trim().toLowerCase();
    if (!q) return data.participants;
    return data.participants.filter((p: any) => {
      const user = Array.isArray(p.users) ? p.users[0] : p.users;
      return user?.name?.toLowerCase().includes(q);
    });
  }, [data?.participants, endorseSearch]);

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
              <div className="col-span-1 flex h-11 items-center justify-center rounded-2xl border border-mint/50 bg-mint/14 text-sm font-semibold text-mint">
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

          <div className="space-y-2 rounded-2xl border border-border bg-black/10 p-3">
            <p className="text-sm font-medium">Кого хочешь отметить после события?</p>
            <p className="text-xs text-muted">Только 👍, без текста. Это улучшает рекомендации и уровни.</p>
            <Input value={endorseSearch} onChange={(e) => setEndorseSearch(e.target.value)} placeholder="Поиск участника по имени" />
            <div className="space-y-2">
              {filteredParticipants.map((p: any) => {
                const user = Array.isArray(p.users) ? p.users[0] : p.users;
                if (!user) return null;
                const sent = endorsedIds.includes(user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-2">
                    <Link href={`/profile/${user.id}`} className="flex items-center gap-2 text-sm text-muted hover:text-text">
                      <Image src={user.avatar_url || "https://placehold.co/100"} alt={user.name} width={100} height={100} className="h-8 w-8 rounded-full object-cover" unoptimized />
                      {user.name}
                    </Link>
                    <Button size="sm" variant={sent ? "secondary" : "default"} onClick={() => endorse(user.id)} disabled={sent || endorseLoadingId === user.id}>
                      {sent ? "Отмечен" : endorseLoadingId === user.id ? "..." : "Отметить 👍"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

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
