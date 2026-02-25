"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type Conversation = {
  user: { id: string; name: string; avatar_url: string | null };
  lastMessage: { content: string; created_at: string; from_user_id: string };
};

export default function MessagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ conversations: Conversation[] }>("/api/messages"),
    refetchInterval: 5000,
  });

  return (
    <PageShell>
      <div className="space-y-2 pb-24">
        <h1 className="px-1 text-xl font-semibold">Сообщения</h1>

        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}

        {!isLoading && !data?.conversations.length && (
          <p className="py-10 text-center text-sm text-muted">
            Нет диалогов. Начни общаться через раздел Люди.
          </p>
        )}

        {data?.conversations.map(({ user, lastMessage }) => (
          <Link
            key={user.id}
            href={`/messages/${user.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:bg-white/10"
          >
            <Image
              src={user.avatar_url || "https://placehold.co/100"}
              alt={user.name}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
              unoptimized
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted">{lastMessage.content}</p>
            </div>
            <p className="shrink-0 text-xs text-muted">
              {new Date(lastMessage.created_at).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
