"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Briefcase, GraduationCap, Handshake, MapPin, Phone, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";
import { getThemeGradient } from "@/lib/profile-style";

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
    queryKey: ["profile-v5", params.id],
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

  if (isLoading)
    return (
      <PageShell>
        <Skeleton className="h-56 w-full rounded-3xl" />
      </PageShell>
    );

  if (!data?.profile)
    return (
      <PageShell>
        <Card>
          <CardContent className="p-4 text-sm text-muted">Профиль не найден</CardContent>
        </Card>
      </PageShell>
    );

  const p = data.profile;
  const themeGradient = getThemeGradient(p.profileTheme);

  return (
    <PageShell>
      <Card className="mb-3 overflow-hidden border-white/15 bg-surface/95 backdrop-blur-xl">
        <div className="relative h-48 overflow-hidden border-b border-border/60" style={{ background: themeGradient }}>
          <div className="absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(119,149,255,0.30),transparent_70%)]" />
          <div className="absolute -right-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,208,255,0.26),transparent_70%)]" />
          <div className="absolute left-0 top-0 h-full w-24 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_8px)] opacity-35" />
          <div className="absolute right-0 top-0 h-full w-24 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_8px)] opacity-35" />

          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <Image
              src={p.avatar_url || "https://placehold.co/420x420"}
              alt={p.name}
              width={160}
              height={160}
              className="mx-auto h-32 w-32 rounded-[30px] border-2 border-white/70 object-cover shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              unoptimized
            />
            <div className="mt-2 inline-flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-text">{p.name}</h1>
              <ProfileEmojiBadge value={p.profileEmoji} />
            </div>
            {p.lastActiveLabel ? <p className="text-xs text-muted">{p.lastActiveLabel}</p> : null}
            {p.phone_masked ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                <Phone className="h-3.5 w-3.5" /> {p.phone_masked}
              </p>
            ) : null}
          </div>
        </div>

        <CardContent className="space-y-4 p-4">
          {p.bio ? <p className="text-sm leading-6 text-text">{p.bio}</p> : null}

          {p.vibeTag ? (
            <div className="inline-flex rounded-full border border-[#6f9fff]/40 bg-[#6f9fff]/12 px-3 py-1 text-xs text-[#dfe8ff]">{p.vibeTag}</div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {p.city ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/70 px-3 py-1">
                <MapPin className="h-3.5 w-3.5" /> {p.city}
                {p.country ? `, ${p.country}` : ""}
              </span>
            ) : null}
            {p.work ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/70 px-3 py-1">
                <Briefcase className="h-3.5 w-3.5" /> {p.work}
              </span>
            ) : null}
            {p.university ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/70 px-3 py-1">
                <GraduationCap className="h-3.5 w-3.5" /> {p.university}
              </span>
            ) : null}
            {p.activity ? <span className="rounded-full border border-border bg-surface2/70 px-3 py-1">Деятельность: {p.activity}</span> : null}
            {p.specialty ? <span className="rounded-full border border-border bg-surface2/70 px-3 py-1">Специальность: {p.specialty}</span> : null}
          </div>

          {!!p.interests?.length ? (
            <div className="flex flex-wrap gap-2">
              {p.interests.map((interest: string) => (
                <span key={interest} className="rounded-full border border-[#6caef2]/30 bg-[#16304f]/70 px-3 py-1 text-xs text-[#e2eeff]">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}

          {!!p.facts?.length ? (
            <div className="grid grid-cols-1 gap-2">
              {p.facts.slice(0, 3).map((fact: string, idx: number) => (
                <div key={`${fact}-${idx}`} className="rounded-xl border border-border bg-surface2/70 p-3 text-sm text-text">
                  {fact}
                </div>
              ))}
            </div>
          ) : null}


          {!!p.topBadges?.length ? (
            <div className="flex flex-wrap gap-2">
              {p.topBadges.map((b: any) => (
                <span key={b.id} className="rounded-full border border-[#8eb8ff]/35 bg-[#8eb8ff]/10 px-3 py-1 text-xs text-[#d9e8ff]">
                  {b.title}
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#6f9fff]/35 bg-[#6f9fff]/12 p-3 text-sm text-[#dbe6ff]">
            <p className="inline-flex items-center gap-1 font-medium text-[#edf3ff]">
              <Sparkles className="h-4 w-4" /> Позитивный факт
            </p>
            <p className="mt-1">{data.positiveFact}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={connect} disabled={connectLoading}>
              <Handshake className="mr-1 h-4 w-4" /> {connectLoading ? "Загрузка..." : "Познакомиться"}
            </Button>
            <div className="rounded-xl border border-border bg-surface2/70 px-3 py-2 text-center text-xs text-muted">
              Отметили после встреч: {p.endorsementsCount ?? 0}
            </div>
          </div>

          {p.eventHistory?.length ? (
            <div className="space-y-1 rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">История мероприятий ({p.eventHistoryCount})</p>
              {p.eventHistory.slice(0, 4).map((e: any) => {
                const event = Array.isArray(e.events) ? e.events[0] : e.events;
                return event ? (
                  <p key={event.id} className="text-xs text-text">
                    • {event.title} · {event.city}
                  </p>
                ) : null;
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "Всё" },
          { id: "videos", label: "Видео" },
          { id: "photos", label: "Фото" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              tab === t.id ? "border-action bg-action/20 text-action" : "border-border bg-surface2/70 text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-2">
        {list.map((post, idx) => (
          <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
            <Card className="overflow-hidden">
              <CardContent className="space-y-2 p-3">
                {post.type === "reel" ? (
                  <video src={post.photos[0]?.url} className="h-64 w-full rounded-2xl object-cover" controls playsInline />
                ) : (
                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl">
                    {post.photos.map((photo, i) => (
                      <Image
                        key={`${post.id}-${i}`}
                        src={photo.url || "https://placehold.co/900x1200"}
                        alt="post"
                        width={900}
                        height={1200}
                        className="h-64 w-full min-w-full snap-center rounded-2xl object-cover"
                        unoptimized
                      />
                    ))}
                  </div>
                )}
                {post.caption ? <p className="text-sm text-text">{post.caption}</p> : null}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {!list.length ? <p className="text-sm text-muted">Публикаций пока нет</p> : null}
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogHeader>
          <DialogTitle>Подсказки для знакомства</DialogTitle>
        </DialogHeader>
        {!connectData ? (
          <p className="text-sm text-muted">Собираем рекомендации...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">Стиль общения</p>
              <p className="text-text">{connectData.vibeStatus}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">О чём начать</p>
              {(connectData.messages ?? []).slice(0, 2).map((m: string) => (
                <p key={m} className="text-text">• {m}</p>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">Готовые первые сообщения</p>
              {(connectData.firstMessages ?? []).slice(0, 3).map((m: string) => (
                <p key={m} className="text-text">• {m}</p>
              ))}
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
