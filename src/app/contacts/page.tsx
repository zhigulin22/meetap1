"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, X, Sparkles, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [findingNew, setFindingNew] = useState(false);
  const [index, setIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", "discover"],
    queryFn: () => api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(`/api/contacts`),
  });

  const pool = useMemo(() => {
    const hot = data?.hotMatches ?? [];
    const people = data?.people ?? [];
    const seen = new Set<string>();
    const merged: MatchPerson[] = [];
    for (const item of [...hot, ...people]) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged;
  }, [data]);

  const current = pool[index] ?? null;

  async function findNewPeople() {
    setFindingNew(true);
    try {
      const fresh = await api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(
        `/api/contacts?refresh=1`,
      );
      queryClient.setQueryData(["contacts", "discover"], fresh);
      setIndex(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось найти новых людей");
    } finally {
      setFindingNew(false);
    }
  }

  function skip() {
    if (!pool.length) return;
    setIndex((prev) => (prev + 1 >= pool.length ? 0 : prev + 1));
  }

  function connect(person: MatchPerson) {
    router.push(`/chats/${person.id}`);
  }

  return (
    <PageShell>
      <div className="mb-4 rounded-[36px] bg-[linear-gradient(180deg,rgba(18,24,50,0.96),rgba(10,14,30,0.98))] p-6 shadow-[0_30px_70px_rgba(7,10,26,0.7)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-text">Люди</h1>
            <p className="text-[15px] text-text2">Подбор по интересам, событиям и совместимости</p>
          </div>
          <Button size="lg" variant="secondary" onClick={() => void findNewPeople()} disabled={findingNew}>
            {findingNew ? "Ищем…" : "Обновить"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[60vh] w-full rounded-[32px]" />
          <Skeleton className="h-16 w-full rounded-[24px]" />
        </div>
      ) : null}

      {!isLoading && !current ? (
        <EmptyState
          title="Новых людей пока нет"
          description="Попробуй обновить подборку или зайди чуть позже."
          cta={{ label: "Обновить", onClick: () => void findNewPeople() }}
        />
      ) : null}

      {current ? (
        <div className="space-y-4 pb-24">
          <Card className="overflow-hidden rounded-[32px] border border-[color:var(--border-strong)] bg-[rgb(var(--surface-1-rgb)/0.9)]">
            <div className="relative h-[52vh] min-h-[420px]">
              <Image
                src={current.avatar_url || "https://placehold.co/1200x1600?text=MEETAP"}
                alt={current.name}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,9,20,0.15),rgba(6,9,20,0.85))]" />
              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--surface-1-rgb)/0.8)] px-3 py-1 text-xs text-text">
                <Sparkles className="h-4 w-4" /> {current.compatibility}% совместимость
              </div>
              <div className="absolute bottom-5 left-5 right-5 space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{current.name}</h2>
                    <p className="text-sm text-text2">{current.reason || "Совпали интересы и стиль общения"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(current.common ?? []).slice(0, 6).map((item) => (
                    <span key={item} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] px-3 py-1 text-xs text-text">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <CardContent className="space-y-3 p-4">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] p-3">
                <p className="text-xs text-text3">Повод написать</p>
                <p className="text-sm text-text">Можно начать с общих интересов или события, где вы пересеклись.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="h-12" onClick={skip}>
                  <X className="mr-1 h-4 w-4" /> Пропустить
                </Button>
                <Button className="h-12" onClick={() => connect(current)}>
                  <Heart className="mr-1 h-4 w-4" /> Познакомиться
                </Button>
                <Button variant="secondary" className="h-12" onClick={() => router.push(`/profile/${current.id}`)}>
                  <MessageCircle className="mr-1 h-4 w-4" /> Профиль
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}
