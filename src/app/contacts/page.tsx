"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, HeartHandshake, MapPin, Sparkles, Users } from "lucide-react";
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

type ModeKey = "friends" | "relationships" | "networking";

type ScopeKey = "for_you" | "events" | "nearby";

const modes: { id: ModeKey; label: string; hint: string }[] = [
  { id: "friends", label: "Друзья", hint: "Тёплые связи и общие интересы" },
  { id: "relationships", label: "Отношения", hint: "Глубокие совпадения и доверие" },
  { id: "networking", label: "Нетворкинг", hint: "Партнёры и рост" },
];

const scopes: { id: ScopeKey; label: string }[] = [
  { id: "for_you", label: "Для тебя" },
  { id: "events", label: "События" },
  { id: "nearby", label: "Рядом" },
];

export default function ContactsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<ModeKey>("friends");
  const [scope, setScope] = useState<ScopeKey>("for_you");
  const [open, setOpen] = useState(false);
  const [ice, setIce] = useState<{ user: string; insight: ConnectInsight } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["contacts", q, mode, scope],
    queryFn: () => api<{ people: MatchPerson[]; groups: any[]; hotMatches: MatchPerson[] }>(`/api/contacts?q=${encodeURIComponent(q)}&mode=${mode}&scope=${scope}`),
  });

  async function connect(person: MatchPerson) {
    try {
      const res = await api<{ icebreaker: ConnectInsight }>("/api/contacts/connect", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: person.id,
          context: `Совместимость ${person.compatibility}% • ${mode}`,
        }),
      });

      setIce({ user: person.name, insight: res.icebreaker });
      setOpen(true);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать интро");
    }
  }

  const people = data?.people ?? [];
  const groups = data?.groups ?? [];
  const hotMatches = data?.hotMatches ?? [];

  const focusPeople = useMemo(() => {
    if (scope === "events") return people.slice(0, 4);
    return people;
  }, [people, scope]);

  return (
    <PageShell>
      <TopBar
        title="Люди"
        subtitle="Подбор по цели знакомства, совместимости и контексту"
        right={<Pill tone="mint">MATCH</Pill>}
      />

      <div className="space-y-3">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-3">
          <p className="text-xs text-text3">Цель знакомства</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  mode === item.id
                    ? "bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))] text-white shadow-soft"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] text-text2"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text2">{modes.find((m) => m.id === mode)?.hint}</p>
        </div>

        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-3">
          <p className="text-xs text-text3">Источник совпадений</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {scopes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  scope === item.id
                    ? "bg-[rgb(var(--violet-rgb)/0.22)] text-white shadow-[0_10px_20px_rgb(var(--violet-rgb)/0.2)]"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] text-text2"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, интерес, событие" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>План знакомства: {ice?.user}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {ice?.insight.profileSummary ? (
            <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.74)] p-3 text-text2">{ice.insight.profileSummary}</div>
          ) : null}

          {ice?.insight.messages.map((m) => (
            <div key={m} className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-2">
              {m}
            </div>
          ))}

          <p className="text-text3">Тема: {ice?.insight.topic}</p>
          <p className="text-text3">Вопрос: {ice?.insight.question}</p>
        </div>
      </Dialog>

      <div className="space-y-3 pb-2">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card backdrop-blur-xl">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Лучшие совпадения</h2>
                <p className="text-xs text-text2">Мы показали людей с похожими интересами и стилем общения</p>
              </div>
              <Pill tone="violet">{mode}</Pill>
            </div>

            {(hotMatches ?? []).length ? (
              (hotMatches ?? []).map((person) => (
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
                      <Link href={`/profile/${person.id}`} className="truncate text-sm font-medium hover:text-[rgb(var(--violet-rgb))]">
                        {person.name}
                      </Link>
                      <p className="text-xs text-text2">{person.reason}</p>
                    </div>
                    <div className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)] px-2 py-1 text-xs">
                      {person.compatibility}%
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs text-text2">{person.common.join(", ") || "Похожий стиль общения и цель"}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[rgb(var(--success-rgb))]">
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
                cta={{ label: "Обновить профиль", onClick: () => router.push("/profile/me/edit") }}
              />
            )}
          </CardContent>
        </Card>

        {scope === "events" ? (
          <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card backdrop-blur-xl">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[rgb(var(--violet-rgb))]" />
                <h2 className="text-sm font-semibold">Идут на события</h2>
              </div>
              {(groups ?? []).length ? (
                (groups ?? []).map((group) => (
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
                    <Sparkles className="h-4 w-4 text-[rgb(var(--gold-rgb))]" />
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Пока нет подходящих событий"
                  description="Событий в текущем сегменте мало."
                  hint="Проверь позже или открой раздел ивентов вручную."
                  cta={{ label: "Открыть ивенты", onClick: () => router.push("/events") }}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card backdrop-blur-xl">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
                <h2 className="text-sm font-semibold">Люди рядом</h2>
              </div>
              {focusPeople.length ? (
                focusPeople.slice(0, 4).map((person) => (
                  <div key={person.id} className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] p-2">
                    <div className="flex items-center gap-2">
                      <Image src={person.avatar_url || "https://placehold.co/100"} alt={person.name} width={48} height={48} className="h-9 w-9 rounded-full object-cover" unoptimized />
                      <div>
                        <p className="text-sm text-text">{person.name}</p>
                        <p className="text-xs text-text2">{person.reason}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => connect(person)}>Связаться</Button>
                  </div>
                ))
              ) : (
                <EmptyState title="Пока нет людей рядом" description="Расширь радиус или попробуй другой режим" />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
