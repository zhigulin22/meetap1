"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Briefcase, CheckCircle2, GraduationCap, Handshake, MapPin, Phone, Sparkles, Star } from "lucide-react";
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
    queryKey: ["profile-v6", params.id],
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

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </PageShell>
    );
  }

  if (!data?.profile) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-4 text-sm text-muted">Профиль не найден</CardContent>
        </Card>
      </PageShell>
    );
  }

  const p = data.profile;
  const themeGradient = getThemeGradient(p.profileTheme);

  return (
    <PageShell>
      <Card className="mb-3 overflow-hidden border-borderStrong bg-[rgb(var(--surface-2-rgb)/0.92)] shadow-card backdrop-blur-2xl">
        <div className="relative h-[20.8rem] overflow-hidden border-b border-border" style={{ background: themeGradient }}>
          <div className="absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--blue-rgb)/0.40),transparent_68%)]" />
          <div className="absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--mint-rgb)/0.34),transparent_68%)]" />
          <div className="absolute inset-y-0 left-0 w-24 bg-[repeating-linear-gradient(135deg,rgb(var(--border-rgb)/0.10)_0px,rgb(var(--border-rgb)/0.10)_1px,transparent_1px,transparent_9px)] opacity-45" />
          <div className="absolute inset-y-0 right-0 w-24 bg-[repeating-linear-gradient(45deg,rgb(var(--border-rgb)/0.10)_0px,rgb(var(--border-rgb)/0.10)_1px,transparent_1px,transparent_9px)] opacity-45" />

          <div className="absolute inset-x-0 bottom-4 z-10 text-center">
            <Image
              src={p.avatar_url || "https://placehold.co/560x560"}
              alt={p.name}
              width={220}
              height={220}
              className="mx-auto h-44 w-44 rounded-[38px] border-2 border-white/55 object-cover shadow-[0_22px_54px_rgba(5,12,28,0.45)]"
              unoptimized
            />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/22 px-3 py-1.5 backdrop-blur-xl">
              <h1 className="font-display text-[1.35rem] font-semibold leading-none text-text">{p.name}</h1>
              <ProfileEmojiBadge value={p.profileEmoji} />
              {p.telegram_verified ? <span title="Профиль подтвержден"><CheckCircle2 className="h-4 w-4 text-mint" /></span> : null}
              {p.profile_completed ? <span title="Профиль заполнен"><Star className="h-4 w-4 text-amber" /></span> : null}
            </div>
            {p.lastActiveLabel ? <p className="mt-1 text-xs text-text2">{p.lastActiveLabel}</p> : null}
            {p.phone_masked ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-text2">
                <Phone className="h-3.5 w-3.5" /> {p.phone_masked}
              </p>
            ) : null}
          </div>
        </div>

        <CardContent className="space-y-4 p-4">
          {p.bio ? <p className="text-sm leading-6 text-text">{p.bio}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] px-3 py-2 text-left">
              <p className="text-[11px] text-text3">Посещено мероприятий</p>
              <p className="text-sm font-semibold text-text">{p.eventHistoryCount ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] px-3 py-2 text-left">
              <p className="text-[11px] text-text3">Отметили после встреч</p>
              <p className="text-sm font-semibold text-text">{p.endorsementsCount ?? 0}</p>
            </div>
          </div>

          {p.mood ? (
            <div className="rounded-2xl border border-blue/35 bg-[linear-gradient(120deg,rgb(var(--blue-rgb)/0.18),rgb(var(--mint-rgb)/0.14))] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-blue/70">Эмоции / настроение</p>
              <p className="mt-1 text-sm text-text">{p.mood}</p>
            </div>
          ) : null}

          {p.vibeTag ? (
            <div className="inline-flex rounded-full border border-blue/35 bg-[linear-gradient(120deg,rgb(var(--blue-rgb)/0.2),rgb(var(--mint-rgb)/0.16))] px-3 py-1 text-xs text-text">{p.vibeTag}</div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {p.city ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/64 px-3 py-1.5 text-text">
                <MapPin className="h-3.5 w-3.5" /> {p.city}
                {p.country ? `, ${p.country}` : ""}
              </span>
            ) : null}
            {p.work ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/64 px-3 py-1.5 text-text">
                <Briefcase className="h-3.5 w-3.5" /> {p.work}
              </span>
            ) : null}
            {p.university ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2/64 px-3 py-1.5 text-text">
                <GraduationCap className="h-3.5 w-3.5" /> {p.university}
              </span>
            ) : null}
            {p.activity ? <span className="rounded-full border border-border bg-surface2/64 px-3 py-1.5 text-text">{p.activity}</span> : null}
            {p.specialty ? <span className="rounded-full border border-border bg-surface2/64 px-3 py-1.5 text-text">{p.specialty}</span> : null}
          </div>

          {!!p.interests?.length ? (
            <div className="flex flex-wrap gap-2">
              {p.interests.map((interest: string) => (
                <span
                  key={interest}
                  className="rounded-full border border-transparent bg-[linear-gradient(rgb(var(--surface-1-rgb)/0.92),rgb(var(--surface-1-rgb)/0.92))_padding-box,linear-gradient(135deg,rgb(var(--blue-rgb)/0.78),rgb(var(--mint-rgb)/0.72),rgb(var(--amber-rgb)/0.72))_border-box] px-3 py-1 text-xs text-text"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : null}

          {!!p.facts?.length ? (
            <div className="grid grid-cols-1 gap-2">
              {p.facts.slice(0, 3).map((fact: string, idx: number) => (
                <div key={`${fact}-${idx}`} className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] p-3 text-sm text-text">
                  {fact}
                </div>
              ))}
            </div>
          ) : null}

          {!!p.topBadges?.length ? (
            <div className="flex flex-wrap gap-2">
              {p.topBadges.map((b: any) => (
                <span key={b.id} className="rounded-full border border-blue/35 bg-blue/14 px-3 py-1 text-xs text-text">
                  {b.title}
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-mint/30 bg-mint/12 p-3 text-sm text-mint/90">
            <p className="inline-flex items-center gap-1 font-medium text-mint/90">
              <Sparkles className="h-4 w-4" /> Позитивный факт
            </p>
            <p className="mt-1">{data.positiveFact}</p>
          </div>

          {!p.is_owner ? (
            <Button
              onClick={connect}
              disabled={connectLoading}
              className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,var(--blue),var(--mint))] text-bg shadow-card"
            >
              <Handshake className="mr-2 h-4 w-4" /> {connectLoading ? "Загрузка..." : "Познакомиться"}
            </Button>
          ) : (
            <div className="rounded-2xl border border-border bg-surface2/68 px-3 py-2 text-center text-xs text-text2">
              Это ваш публичный preview. CTA знакомства скрыт.
            </div>
          )}

          {p.eventHistory?.length ? (
            <div className="space-y-1 rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
              <p className="text-xs text-text2">История мероприятий ({p.eventHistoryCount})</p>
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
              tab === t.id
                ? "border-blue/45 bg-blue/16 text-text"
                : "border-border bg-surface2/60 text-text3"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-2">
        {list.map((post, idx) => (
          <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
            <Card className="overflow-hidden border-border bg-[rgb(var(--surface-2-rgb)/0.9)] shadow-card backdrop-blur-2xl">
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

        {!list.length ? <p className="text-sm text-text2">Публикаций пока нет</p> : null}
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
                <p key={m} className="text-text">
                  • {m}
                </p>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">Готовые первые сообщения</p>
              {(connectData.firstMessages ?? []).slice(0, 3).map((m: string) => (
                <p key={m} className="text-text">
                  • {m}
                </p>
              ))}
            </div>
            <Button className="w-full" onClick={() => setConnectOpen(false)}>
              Понял, написать самому
            </Button>
          </div>
        )}
      </Dialog>

      <div className="pb-20 text-center text-xs text-muted">
        <Link href="/profile/me" className="underline">
          Открыть настройки своего профиля
        </Link>
      </div>
    </PageShell>
  );
}
