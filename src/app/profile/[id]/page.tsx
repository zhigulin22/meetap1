"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type PostItem = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
  photos: Array<{ kind: string; url: string }>;
};

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<"all" | "videos" | "photos">("all");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectData, setConnectData] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-v3", params.id],
    queryFn: () =>
      api<{
        profile: any;
        positiveFact: string;
        content: { all: PostItem[]; videos: PostItem[]; photos: PostItem[] };
      }>(`/api/profile/${params.id}`),
  });

  const list = useMemo(() => {
    if (!data) return [] as PostItem[];
    if (tab === "videos") return data.content.videos;
    if (tab === "photos") return data.content.photos;
    return data.content.all;
  }, [data, tab]);

  async function connect() {
    try {
      setConnectLoading(true);
      const res = await api<{ icebreaker: any }>("/api/contacts/connect", {
        method: "POST",
        body: JSON.stringify({ targetUserId: params.id, context: "знакомство из профиля" }),
      });
      setConnectData(res.icebreaker);
      setConnectOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось открыть connect-flow");
    } finally {
      setConnectLoading(false);
    }
  }

  if (isLoading) return <PageShell><Skeleton className="h-56 w-full rounded-3xl" /></PageShell>;
  if (!data?.profile) return <PageShell><Card><CardContent className="p-4 text-sm text-muted">Профиль не найден</CardContent></Card></PageShell>;

  const p = data.profile;

  return (
    <PageShell>
      <Card className="mb-3 overflow-hidden border-white/15 bg-surface/90 backdrop-blur-xl">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(10,18,60,0.95),rgba(82,204,131,0.3),rgba(90,125,255,0.45))]" />
        <CardContent className="space-y-4 p-4">
          <div className="-mt-10 flex items-end gap-3">
            <Image src={p.avatar_url || "https://placehold.co/120"} alt={p.name} width={120} height={120} className="h-20 w-20 rounded-3xl border-2 border-white/70 object-cover" unoptimized />
            <div className="pb-1">
              <h1 className="text-xl font-semibold">{p.name}</h1>
              <p className="text-xs text-muted">Уровень {p.level}</p>
              {p.lastActiveLabel ? <p className="text-xs text-muted">{p.lastActiveLabel}</p> : null}
            </div>
          </div>

          {p.featuredBadge ? (
            <div className="rounded-full border border-[#8eb8ff]/40 bg-[#8eb8ff]/10 px-3 py-1 text-xs text-[#cfe0ff]">
              Бейдж: {p.featuredBadge.title}
            </div>
          ) : null}

          {!!p.topBadges?.length ? (
            <div className="flex flex-wrap gap-2">
              {p.topBadges.map((b: any) => (
                <span key={b.id} className="rounded-full border border-border bg-black/10 px-3 py-1 text-xs text-muted">{b.title}</span>
              ))}
            </div>
          ) : null}

          {p.bio ? <p className="text-sm leading-6">{p.bio}</p> : null}

          <p className="text-sm text-muted">
            {[p.country, p.university, p.work].filter(Boolean).join(" · ") || "Пользователь не раскрыл детали профиля"}
          </p>

          {!!p.facts?.length ? (
            <div className="grid grid-cols-1 gap-2">
              {p.facts.slice(0, 3).map((fact: string, idx: number) => (
                <div key={`${fact}-${idx}`} className="rounded-xl border border-border bg-black/10 p-2 text-sm">{fact}</div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(p.interests ?? []).slice(0, 20).map((i: string) => (
              <span key={i} className="rounded-full border border-border bg-[#16304f]/70 px-3 py-1 text-xs text-[#dbeafe]">{i}</span>
            ))}
          </div>

          <div className="rounded-xl border border-[#52CC83]/35 bg-[#52CC83]/12 p-3 text-xs text-[#c8f7d8]">
            {data.positiveFact}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={connect} disabled={connectLoading}>{connectLoading ? "..." : "Познакомиться"}</Button>
            <div className="rounded-xl border border-border bg-black/10 px-3 py-2 text-center text-xs text-muted">
              Отметили после встреч: {p.endorsementsCount ?? 0}
            </div>
          </div>

          {p.eventHistory?.length ? (
            <div className="space-y-1 rounded-xl border border-border bg-black/10 p-3">
              <p className="text-xs text-muted">История мероприятий ({p.eventHistoryCount})</p>
              {p.eventHistory.slice(0, 4).map((e: any) => {
                const event = Array.isArray(e.events) ? e.events[0] : e.events;
                return event ? <p key={event.id} className="text-xs">• {event.title} · {event.city}</p> : null;
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", label: "Всё" }, { id: "videos", label: "Видео" }, { id: "photos", label: "Фото" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`rounded-full border px-3 py-1.5 text-xs ${tab === t.id ? "border-action bg-action/20 text-action" : "border-border bg-white/5 text-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-2">
        {list.map((post) => (
          <Card key={post.id} className="overflow-hidden">
            <CardContent className="space-y-2 p-3">
              {post.type === "reel" ? (
                <video src={post.photos[0]?.url} className="h-64 w-full rounded-2xl object-cover" controls playsInline />
              ) : (
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl">
                  {post.photos.map((photo, idx) => (
                    <Image key={`${post.id}-${idx}`} src={photo.url || "https://placehold.co/900x1200"} alt="post" width={900} height={1200} className="h-64 w-full min-w-full snap-center rounded-2xl object-cover" unoptimized />
                  ))}
                </div>
              )}
              {post.caption ? <p className="text-sm">{post.caption}</p> : null}
            </CardContent>
          </Card>
        ))}
        {!list.length ? <p className="text-sm text-muted">Публикаций пока нет</p> : null}
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogHeader><DialogTitle>Подсказки для знакомства</DialogTitle></DialogHeader>
        {!connectData ? (
          <p className="text-sm text-muted">Собираем рекомендации...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-black/10 p-3">
              <p className="text-xs text-muted">Стиль общения</p>
              <p>{connectData.vibeStatus}</p>
            </div>
            <div className="rounded-xl border border-border bg-black/10 p-3">
              <p className="text-xs text-muted">О чём начать</p>
              {(connectData.messages ?? []).slice(0, 2).map((m: string) => <p key={m}>• {m}</p>)}
            </div>
            <div className="rounded-xl border border-border bg-black/10 p-3">
              <p className="text-xs text-muted">Готовые первые сообщения</p>
              {(connectData.firstMessages ?? []).slice(0, 3).map((m: string) => <p key={m}>• {m}</p>)}
            </div>
            <Button className="w-full" onClick={() => setConnectOpen(false)}>Понял, написать самому</Button>
          </div>
        )}
      </Dialog>

      <div className="pb-20 text-center text-xs text-muted">
        <Link href="/profile/me" className="underline">Открыть настройки своего профиля</Link>
      </div>
    </PageShell>
  );
}
