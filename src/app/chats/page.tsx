"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type ChatItem = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  last_message_from_me: boolean;
  messages_count: number;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  return sameDay
    ? date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export default function ChatsPage() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["chats", q],
    queryFn: () => api<{ items: ChatItem[] }>(`/api/messages/chats?q=${encodeURIComponent(q)}`),
    refetchInterval: 3000,
  });

  return (
    <PageShell>
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#75a7ff]/30 bg-[#75a7ff]/10 text-[#9cc0ff]">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Чаты</h1>
            <p className="text-xs text-muted">Личные диалоги как в мессенджере</p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени или сообщению"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-white/15 bg-surface/90 backdrop-blur-xl">
        <CardContent className="space-y-1 p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}

          {!isLoading && !(data?.items ?? []).length ? (
            <div className="rounded-2xl border border-border bg-black/10 p-4 text-sm text-muted">
              Чатов пока нет. Открой пост в ленте и начни диалог.
            </div>
          ) : null}

          {(data?.items ?? []).map((chat) => (
            <Link
              key={chat.user_id}
              href={`/chats/${chat.user_id}`}
              className="flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition hover:border-white/15 hover:bg-black/10"
            >
              <Image
                src={chat.avatar_url || "https://placehold.co/100"}
                alt={chat.name}
                width={96}
                height={96}
                className="h-12 w-12 rounded-full object-cover"
                unoptimized
              />

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{chat.name}</p>
                  <span className="text-[11px] text-muted">{formatTime(chat.last_message_at)}</span>
                </div>
                <p className="line-clamp-1 text-xs text-muted">
                  {chat.last_message_from_me ? "Вы: " : ""}
                  {chat.last_message}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
