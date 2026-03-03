"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartHandshake, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

type MatchPerson = {
  id: string;
  name: string;
  avatar_url: string | null;
  interests: string[] | null;
  compatibility: number;
  common: string[];
  reason: string;
};

type ConnectInsight = {
  messages: string[];
  topic: string;
  question: string;
  profileSummary?: string;
  approachTips?: string[];
  offlineIdeas?: string[];
  onlineIdeas?: string[];
  sharedSignals?: string[];
};

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [ice, setIce] = useState<{ user: string; insight: ConnectInsight } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["contacts", q],
    queryFn: () =>
      api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(
        `/api/contacts?q=${encodeURIComponent(q)}`,
      ),
  });

  async function connect(person: MatchPerson) {
    try {
      const res = await api<{ icebreaker: ConnectInsight }>("/api/contacts/connect", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: person.id,
          context: `Совместимость ${person.compatibility}%`,
        }),
      });

      setIce({ user: person.name, insight: res.icebreaker });
      setOpen(true);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать интро");
    }
  }

  return (
    <PageShell>
      <div className="mb-3 space-y-2">
        <h1 className="text-2xl font-semibold">Найти людей</h1>
        <p className="text-xs text-muted">AI подскажет, как лучше познакомиться и о чём начать разговор.</p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, интерес, событие" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>План знакомства: {ice?.user}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {ice?.insight.profileSummary ? (
            <div className="rounded-xl border border-border bg-surface2/56 p-3 text-muted">{ice.insight.profileSummary}</div>
          ) : null}

          <p className="text-muted">Тема: {ice?.insight.topic}</p>
          {ice?.insight.messages.map((m) => (
            <div key={m} className="rounded-xl border border-border bg-black/20 p-2">
              {m}
            </div>
          ))}

          {ice?.insight.approachTips?.length ? (
            <div>
              <p className="text-xs font-medium">Как подойти:</p>
              {ice.insight.approachTips.map((tip) => (
                <p key={tip} className="text-xs text-muted">• {tip}</p>
              ))}
            </div>
          ) : null}

          <p className="text-muted">Вопрос: {ice?.insight.question}</p>
        </div>
      </Dialog>

      <div className="space-y-3 pb-2">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        <Card className="overflow-hidden border-white/10 bg-surface/90 backdrop-blur-xl">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Лучшие совпадения</h2>
              <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">TOP</span>
            </div>

            {(data?.hotMatches ?? []).map((person) => (
              <div key={person.id} className="rounded-2xl border border-border/80 bg-black/10 p-3">
                <div className="flex items-center gap-2">
                  <Image
                    src={person.avatar_url || "https://placehold.co/100"}
                    alt={person.name}
                    width={100}
                    height={100}
                    className="h-10 w-10 rounded-full object-cover"
                    unoptimized
                  />
                  <div className="flex-1">
                    <Link href={`/profile/${person.id}`} className="text-sm font-medium hover:text-action">
                      {person.name}
                    </Link>
                    <p className="text-xs text-muted">{person.reason}</p>
                  </div>
                  <div className="rounded-full border border-border bg-surface2/56 px-2 py-1 text-xs">
                    {person.compatibility}%
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-xs text-muted">
                    {person.common.join(", ") || "Подходите по стилю знакомства"}
                  </p>
                  <Button size="sm" onClick={() => connect(person)}>
                    <HeartHandshake className="mr-1 h-4 w-4" />
                    Хочу познакомиться
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-surface/90 backdrop-blur-xl">
          <CardContent className="space-y-2 p-3">
            <h2 className="text-sm font-semibold">Группы и события</h2>
            {(data?.groups ?? []).map((group) => (
              <Link key={group.id} href={`/events/${group.id}`} className="flex items-center justify-between rounded-xl border border-border/70 p-2 text-sm hover:bg-surface2/56">
                <div>
                  <p>{group.title}</p>
                  <p className="text-xs text-muted">
                    {group.city} · {new Date(group.event_date).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-action" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
