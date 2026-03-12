"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, HeartHandshake, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
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
};

export default function ContactsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [ice, setIce] = useState<{ user: string; insight: ConnectInsight } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["contacts", q],
    queryFn: () => api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(`/api/contacts?q=${encodeURIComponent(q)}`),
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
      <TopBar
        title="Люди"
        subtitle="Подбор с акцентом на доверие, совпадение интересов и мягкий старт диалога"
        right={<Pill tone="mint">MATCH</Pill>}
      />

      <div className="mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, интерес, событие" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>План знакомства: {ice?.user}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {ice?.insight.profileSummary ? (
            <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.74)] p-3 text-muted">{ice.insight.profileSummary}</div>
          ) : null}

          {ice?.insight.messages.map((m) => (
            <div key={m} className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-2">
              {m}
            </div>
          ))}

          <p className="text-muted">Тема: {ice?.insight.topic}</p>
          <p className="text-muted">Вопрос: {ice?.insight.question}</p>
        </div>
      </Dialog>

      <div className="space-y-3 pb-2">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card backdrop-blur-xl">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Лучшие совпадения</h2>
              <Pill>TOP</Pill>
            </div>

            {(data?.hotMatches ?? []).length ? (
              (data?.hotMatches ?? []).map((person) => (
                <div key={person.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={person.avatar_url || "https://placehold.co/100"}
                      alt={person.name}
                      width={100}
                      height={100}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${person.id}`} className="truncate text-sm font-medium hover:text-mint">
                        {person.name}
                      </Link>
                      <p className="text-xs text-text2">{person.reason}</p>
                    </div>
                    <div className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)] px-2 py-1 text-xs">
                      {person.compatibility}%
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs text-text2">{person.common.join(", ") || "Подходите по стилю знакомства"}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-mint/90">
                      <CheckCircle2 className="h-3.5 w-3.5" /> профиль заполнен
                    </span>
                    <Button size="sm" onClick={() => connect(person)}>
                      <HeartHandshake className="mr-1 h-4 w-4" /> Познакомиться
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Пока нет точных совпадений"
                description="Обнови интересы и факты в профиле, чтобы улучшить подбор людей."
                cta={{ label: "Обновить профиль", onClick: () => (router.push("/profile/me/edit")) }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card backdrop-blur-xl">
          <CardContent className="space-y-2 p-3">
            <h2 className="text-sm font-semibold">Группы и события</h2>
            {(data?.groups ?? []).length ? (
              (data?.groups ?? []).map((group) => (
                <Link
                  key={group.id}
                  href={`/events/${group.id}`}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] p-2 text-sm hover:bg-[rgb(var(--surface-2-rgb)/0.76)]"
                >
                  <div>
                    <p>{group.title}</p>
                    <p className="text-xs text-text2">
                      {group.city} · {new Date(group.event_date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <Sparkles className="h-4 w-4 text-gold" />
                </Link>
              ))
            ) : (
              <EmptyState
                title="Пока нет подходящих групп"
                description="Событий в текущем сегменте мало."
                hint="Проверь позже или открой раздел ивентов вручную."
                cta={{ label: "Открыть ивенты", onClick: () => (router.push("/events")) }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
