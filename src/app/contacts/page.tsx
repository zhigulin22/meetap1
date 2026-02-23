"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";
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

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [ice, setIce] = useState<{ user: string; messages: string[]; topic: string; question: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["contacts", q],
    queryFn: () =>
      api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(
        `/api/contacts?q=${encodeURIComponent(q)}`,
      ),
  });

  async function connect(person: MatchPerson) {
    try {
      const res = await api<{ icebreaker: { messages: string[]; topic: string; question: string } }>(
        "/api/contacts/connect",
        {
          method: "POST",
          body: JSON.stringify({
            targetUserId: person.id,
            context: `Совместимость ${person.compatibility}%`,
          }),
        },
      );

      setIce({
        user: person.name,
        messages: res.icebreaker.messages,
        topic: res.icebreaker.topic,
        question: res.icebreaker.question,
      });
      setOpen(true);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать интро");
    }
  }

  return (
    <PageShell>
      <h1 className="mb-3 text-2xl font-semibold">Найти людей</h1>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, интерес, группа" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Интро для знакомства: {ice?.user}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted">Тема: {ice?.topic}</p>
          {ice?.messages.map((m) => (
            <div key={m} className="rounded-xl border border-border bg-black/10 p-2">{m}</div>
          ))}
          <p className="text-muted">Вопрос: {ice?.question}</p>
        </div>
      </Dialog>

      <div className="mt-3 space-y-3">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        <Card>
          <CardContent className="space-y-2 p-3">
            <h2 className="text-sm font-semibold">Лучшие совпадения</h2>
            {(data?.hotMatches ?? []).map((person) => (
              <div key={person.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <Image
                    src={person.avatar_url || "https://placehold.co/100"}
                    alt={person.name}
                    width={100}
                    height={100}
                    className="h-9 w-9 rounded-full object-cover"
                    unoptimized
                  />
                  <div className="flex-1">
                    <Link href={`/profile/${person.id}`} className="text-sm font-medium hover:text-action">
                      {person.name}
                    </Link>
                    <p className="text-xs text-muted">{person.reason}</p>
                  </div>
                  <div className="rounded-full border border-border px-2 py-1 text-xs">
                    {person.compatibility}%
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted">{person.common.join(", ") || "Новые темы для диалога"}</p>
                  <Button size="sm" variant="secondary" onClick={() => connect(person)}>
                    <HeartHandshake className="mr-1 h-4 w-4" />
                    Познакомиться
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-3">
            <h2 className="text-sm font-semibold">Группы / события</h2>
            {(data?.groups ?? []).map((group) => (
              <Link key={group.id} href={`/events/${group.id}`} className="block rounded-xl border border-border p-2 text-sm">
                <p>{group.title}</p>
                <p className="text-xs text-muted">
                  {group.city} · {new Date(group.event_date).toLocaleDateString("ru-RU")}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
