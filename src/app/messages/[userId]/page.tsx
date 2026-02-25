"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type Message = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
};

type ChatData = {
  messages: Message[];
  user: { id: string; name: string; avatar_url: string | null };
  myId: string;
};

export default function DmChatPage() {
  const params = useParams<{ userId: string }>();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dm", params.userId],
    queryFn: () => api<ChatData>(`/api/messages/${params.userId}`),
    refetchInterval: 3000,
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
      const res = await api<{ message: Message }>(`/api/messages/${params.userId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      qc.setQueryData<ChatData>(["dm", params.userId], (prev) =>
        prev ? { ...prev, messages: [...prev.messages, res.message] } : prev,
      );
    } finally {
      setSending(false);
    }
  }

  if (isLoading || !data) {
    return (
      <PageShell>
        <Skeleton className="h-[70vh] w-full rounded-3xl" />
      </PageShell>
    );
  }

  const { messages, user, myId } = data;

  return (
    <PageShell>
      <div className="flex h-[calc(100vh-100px)] flex-col">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <Link href="/messages" className="rounded-xl p-1 hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link href={`/profile/${user.id}`} className="flex items-center gap-2">
            <Image
              src={user.avatar_url || "https://placehold.co/100"}
              alt={user.name}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
            <span className="font-medium">{user.name}</span>
          </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto pb-2">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">Напиши первое сообщение</p>
          )}
          {messages.map((msg) => {
            const mine = msg.from_user_id === myId;
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-action text-accent"
                      : "border border-border bg-surface text-text"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-accent/60" : "text-muted"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Сообщение..."
            maxLength={2000}
            className="flex-1 rounded-2xl border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-action"
          />
          <Button size="icon" onClick={send} disabled={!text.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
