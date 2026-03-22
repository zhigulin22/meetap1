"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type MessageItem = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
};

type ThreadResponse = {
  target: { id: string; name: string; avatar_url: string | null };
  items: MessageItem[];
};

type FirstMessageResponse = {
  items: string[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-thread", params.id],
    queryFn: () => api<ThreadResponse>(`/api/messages/${params.id}`),
    enabled: Boolean(params.id),
    refetchInterval: 2500,
  });
  const isEmptyThread = !isLoading && (data?.items?.length ?? 0) === 0;

  async function fetchFirstMessages(forceRefresh = false) {
    const qs = forceRefresh ? "?refresh=1" : "";
    return api<FirstMessageResponse>(`/api/messages/${params.id}/first-message-suggestions${qs}`);
  }

  const { data: firstMessages, isFetching: firstMessagesLoading } = useQuery({
    queryKey: ["chat-first-messages", params.id],
    queryFn: () => fetchFirstMessages(false),
    enabled: Boolean(params.id) && isEmptyThread,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  async function regenerateSuggestions() {
    if (!params.id) return;
    setRegenerateLoading(true);
    try {
      const fresh = await fetchFirstMessages(true);
      queryClient.setQueryData(["chat-first-messages", params.id], fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось обновить варианты");
    } finally {
      setRegenerateLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.items?.length]);

  async function sendMessage() {
    if (!params.id || !input.trim()) return;

    try {
      await api(`/api/messages/${params.id}`, {
        method: "POST",
        body: JSON.stringify({ content: input.trim() }),
      });
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["chat-thread", params.id] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить сообщение");
    }
  }

  return (
    <PageShell>
      <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/20 bg-[#1d2b54]/75 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <Link href="/chats">
          <Button variant="ghost" size="icon" className="h-9 w-9 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>
        </Link>

        {isLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <div className="flex items-center gap-2">
            <Image
              src={data?.target.avatar_url || "https://placehold.co/100"}
              alt={data?.target.name || "User"}
              width={80}
              height={80}
              className="h-10 w-10 rounded-full object-cover"
              unoptimized
            />
            <div>
              <p className="text-sm font-semibold text-[#f4f7ff]">{data?.target.name ?? "Диалог"}</p>
              <p className="text-[11px] text-[#c9d8f7]">в сети недавно</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 pb-28">
        <div className="max-h-[62vh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b183a70] p-2 backdrop-blur-xl">
          {isLoading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="ml-auto h-16 w-2/3" />
              <Skeleton className="h-16 w-2/3" />
            </div>
          ) : null}

          {(data?.items ?? []).map((message) => (
            <div key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-5 shadow-[0_8px_22px_rgba(0,0,0,0.2)] ${
                  message.is_mine
                    ? "rounded-br-md bg-[#2ea6ff] text-white"
                    : "rounded-bl-md border border-white/15 bg-[#1b284f] text-[#dbe8ff]"
                }`}
              >
                <p>{message.content}</p>
                <p className={`mt-1 text-[10px] ${message.is_mine ? "text-white/80" : "text-[#9db1d8]"}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          ))}

          {isEmptyThread ? (
            <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#dbe8ff]">Варианты первого сообщения</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void regenerateSuggestions();
                  }}
                  disabled={firstMessagesLoading || regenerateLoading}
                  className="h-7 px-2 text-[11px] text-[#c7d8ff] hover:text-white"
                >
                  Обновить
                </Button>
              </div>

              {firstMessagesLoading && !(firstMessages?.items ?? []).length ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              {(firstMessages?.items ?? []).map((message, idx) => (
                <button
                  key={`${idx}-${message}`}
                  onClick={() => setInput(message)}
                  className="w-full rounded-xl border border-[#8ea8dc]/35 bg-[#1f2d57]/70 px-3 py-2 text-left text-sm text-[#edf3ff] transition hover:bg-[#2a3a6d]"
                >
                  {message}
                </button>
              ))}

              {!firstMessagesLoading && !(firstMessages?.items ?? []).length ? (
                <p className="text-xs text-muted">Не удалось сгенерировать варианты. Можно написать вручную.</p>
              ) : null}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div className="fixed inset-x-0 bottom-[80px] z-40 mx-auto flex w-[calc(100%-24px)] max-w-md items-center gap-2 rounded-2xl border border-[#8ea8dc]/45 bg-[#425178cf] p-2 backdrop-blur-xl xl:max-w-lg">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Сообщение"
            className="h-11 border-[#8ea8dc]/65 bg-[#e2e9fb] text-[#0c1833] placeholder:text-[#5d6f92]"
          />
          <Button onClick={sendMessage} className="h-11 min-w-11 rounded-xl px-3">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
