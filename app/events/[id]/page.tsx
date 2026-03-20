"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type EventMessage = {
  id: string;
  from_user_id: string;
  content: string;
  created_at: string;
  user: { id: string; name: string; avatar_url: string | null };
};

function EventChat({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ["event-chat", eventId],
    queryFn: () =>
      api<{ messages: EventMessage[]; myId: string }>(`/api/messages/event/${eventId}`),
    refetchInterval: 4000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await api<{ message: EventMessage }>(`/api/messages/event/${eventId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      qc.setQueryData<{ messages: EventMessage[]; myId: string }>(
        ["event-chat", eventId],
        (prev) => (prev ? { ...prev, messages: [...prev.messages, res.message] } : prev),
      );
    } finally {
      setSending(false);
    }
  }

  const myId = data?.myId;

  return (
    <div className="rounded-2xl border border-border bg-black/10 p-3">
      <p className="mb-2 text-sm font-medium">Чат события</p>
      <div className="mb-2 max-h-48 space-y-2 overflow-y-auto">
        {(data?.messages ?? []).length === 0 && (
          <p className="py-2 text-center text-xs text-muted">Сообщений пока нет</p>
        )}
        {(data?.messages ?? []).map((msg) => {
          const mine = msg.from_user_id === myId;
          return (
            <div key={msg.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : ""}`}>
              {!mine && (
                <Image
                  src={msg.user.avatar_url || "https://placehold.co/100"}
                  alt={msg.user.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  unoptimized
                />
              )}
              <div
                className={`max-w-[70%] rounded-xl px-2.5 py-1.5 text-xs ${
                  mine ? "bg-action text-accent" : "border border-border bg-surface"
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-[10px] font-medium text-muted">{msg.user.name}</p>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Сообщение в чат..."
          maxLength={500}
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-action"
        />
        <Button size="icon" className="h-8 w-8" onClick={send} disabled={!text.trim() || sending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

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

          <EventChat eventId={params.id} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
