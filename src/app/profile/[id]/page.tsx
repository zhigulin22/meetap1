"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Ellipsis,
  Handshake,
  MapPin,
  MessageCircle,
  Play,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";

type PostItem = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
  photos: Array<{ kind: string; url: string }>;
};

function isVideoUrl(url?: string) {
  if (!url) return false;
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url) || url.includes("/video") || url.includes("mov_bbb");
}

function firstPhoto(post: PostItem) {
  return post.photos[0]?.url || "https://placehold.co/800x800";
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<"posts" | "reposts" | "duo">("posts");
  const [duoFilter, setDuoFilter] = useState<"all" | "with" | "group">("all");
  const [following, setFollowing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectData, setConnectData] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-v8", params.id],
    queryFn: () =>
      api<{
        profile: any;
        positiveFact: string;
        content: { all: PostItem[]; videos: PostItem[]; photos: PostItem[] };
      }>(`/api/profile/${params.id}`),
  });

  const p = data?.profile;

  const posts = useMemo(() => {
    return (data?.content.all ?? []).filter((x) => x.type !== "daily_duo");
  }, [data?.content.all]);

  const reposts = useMemo(() => {
    return (data?.content.all ?? []).filter((x) => {
      const cap = (x.caption ?? "").toLowerCase();
      return cap.includes("repost") || cap.includes("репост");
    });
  }, [data?.content.all]);

  const duo = useMemo(() => {
    const base = (data?.content.all ?? []).filter((x) => x.type === "daily_duo");
    if (duoFilter === "all") return base;
    if (duoFilter === "group") {
      return base.filter((x) => (x.caption ?? "").toLowerCase().includes("груп"));
    }
    return base.filter((x) => !(x.caption ?? "").toLowerCase().includes("груп"));
  }, [data?.content.all, duoFilter]);

  const pinned = useMemo(() => posts.slice(0, 3), [posts]);

  const stats = {
    posts: posts.length,
    followers: p?.endorsementsCount ?? 0,
    duos: (data?.content.all ?? []).filter((x) => x.type === "daily_duo").length,
  };

  async function openConnect() {
    if (!p?.id) return;
    try {
      setConnectLoading(true);
      const res = await api<{ icebreaker: any }>("/api/contacts/connect", {
        method: "POST",
        body: JSON.stringify({ targetUserId: p.id, context: "знакомство из публичного профиля" }),
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
        <Skeleton className="h-72 w-full rounded-3xl" />
      </PageShell>
    );
  }

  if (!p) {
    return (
      <PageShell>
        <EmptyState title="Профиль не найден" description="Пользователь недоступен или удален." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TopBar title="Профиль" subtitle="Публичная визитка" />

      <section className="relative mb-3 overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] p-5 shadow-soft">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-12%] top-[14%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.14),transparent_65%)] blur-2xl" />
          <div className="absolute right-[-12%] top-[22%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.15),transparent_66%)] blur-2xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--surface-1-rgb)),rgb(var(--surface-2-rgb)))] opacity-85" />
        </div>

        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-full bg-[image:var(--grad-primary)] p-[3px] shadow-[0_10px_26px_rgb(var(--teal-rgb)/0.2)]">
            <div className="rounded-full border-2 border-white bg-white p-[2px]">
              <Image
                src={p.avatar_url || "https://placehold.co/560x560"}
                alt={p.name}
                width={232}
                height={232}
                className="h-28 w-28 rounded-full object-cover"
                unoptimized
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3">public preview</p>
        </div>
      </section>

      <Card className="mb-3 bg-[rgb(var(--surface-1-rgb)/0.98)]">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.62rem] font-semibold leading-none text-text">{p.name}</h1>
            <ProfileEmojiBadge value={p.profileEmoji} />
            {p.telegram_verified ? <CheckCircle2 className="h-4 w-4 text-[rgb(var(--teal-rgb))]" /> : null}
            <Pill>{p?.preferences?.activity || "Creator"}</Pill>
          </div>

          {p.bio ? <p className="line-clamp-2 text-[15px] leading-6 text-text2">{p.bio}</p> : null}

          {p.city ? (
            <p className="inline-flex items-center gap-1 text-xs text-text2">
              <MapPin className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" /> {p.city}
            </p>
          ) : null}

          {data?.positiveFact ? (
            <div className="rounded-xl border border-[rgb(var(--teal-rgb)/0.26)] bg-[rgb(var(--teal-rgb)/0.1)] px-3 py-2 text-xs text-text2">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" /> {data.positiveFact}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setTab("posts")} className="tap-press rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.84)] px-2 py-2 text-center">
              <p className="text-[17px] font-semibold text-text">{stats.posts}</p>
              <p className="text-[11px] text-text3">Посты</p>
            </button>
            <button type="button" className="tap-press rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.84)] px-2 py-2 text-center">
              <p className="text-[17px] font-semibold text-text">{stats.followers}</p>
              <p className="text-[11px] text-text3">Подписчики</p>
            </button>
            <button type="button" onClick={() => setTab("duo")} className="tap-press rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.84)] px-2 py-2 text-center">
              <p className="text-[17px] font-semibold text-text">{stats.duos}</p>
              <p className="text-[11px] text-text3">DUO</p>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(p.interests ?? []).slice(0, 4).map((interest: string) => (
              <span key={interest} className="rounded-full border border-[rgb(var(--teal-rgb)/0.2)] bg-[rgb(var(--teal-rgb)/0.08)] px-3 py-1 text-xs text-text2">
                {interest}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {!p.is_owner ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button onClick={() => setFollowing((x) => !x)}>
            <UserPlus className="mr-1 h-4 w-4" /> {following ? "Following" : "Follow"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/contacts")}>
            <MessageCircle className="mr-1 h-4 w-4" /> Message
          </Button>
          <Button variant="ghost" onClick={openConnect} disabled={connectLoading}>
            <Handshake className="mr-1 h-4 w-4" /> {connectLoading ? "..." : "Invite DUO"}
          </Button>
          <Button variant="secondary" onClick={() => setMoreOpen(true)}>
            <Ellipsis className="mr-1 h-4 w-4" /> More
          </Button>
        </div>
      ) : null}

      {pinned.length ? (
        <Card className="mb-3 bg-[rgb(var(--surface-2-rgb)/0.88)]">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--teal-rgb))]">Pinned</p>
              <Pill>top</Pill>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {pinned.map((post) => (
                <Link key={post.id} href="/feed" className="block overflow-hidden rounded-xl">
                  <Image src={firstPhoto(post)} alt="pinned" width={300} height={300} className="aspect-square w-full object-cover" unoptimized />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-3 rounded-[14px] bg-[rgb(var(--surface-2-rgb)/0.92)] p-1">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "posts", label: "Посты" },
            { value: "reposts", label: "Репосты" },
            { value: "duo", label: "DUO" },
          ]}
          className="w-full"
        />
      </div>

      {tab === "posts" ? (
        posts.length ? (
          <div className="grid grid-cols-3 gap-2 pb-2">
            {posts.map((post) => {
              const src = firstPhoto(post);
              const video = isVideoUrl(src);
              return (
                <Link key={post.id} href="/feed" className="group relative block overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)]">
                  {video ? (
                    <div className="relative aspect-square">
                      <video src={src} className="h-full w-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <Image src={src} alt="post" width={400} height={400} className="aspect-square w-full object-cover" unoptimized />
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Постов пока нет" description="Этот пользователь еще не публиковал контент." />
        )
      ) : null}

      {tab === "reposts" ? (
        reposts.length ? (
          <div className="grid grid-cols-3 gap-2 pb-2">
            {reposts.map((post) => (
              <Link key={post.id} href="/feed" className="block overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)]">
                <Image src={firstPhoto(post)} alt="repost" width={400} height={400} className="aspect-square w-full object-cover" unoptimized />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Репостов пока нет"
            description="В этом профиле нет публичных репостов за выбранный период."
            hint="Если появятся новые репосты, они отобразятся здесь автоматически."
          />
        )
      ) : null}

      {tab === "duo" ? (
        <div className="space-y-3 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", label: "Все" },
              { id: "with", label: "С кем" },
              { id: "group", label: "Группа" },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setDuoFilter(filter.id as typeof duoFilter)}
                className={`tap-press rounded-full border px-3 py-1.5 text-xs ${
                  duoFilter === filter.id
                    ? "border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--teal-rgb)/0.12)] text-text"
                    : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)] text-text2"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {duo.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {duo.map((item, idx) => {
                const photos = item.photos.slice(0, 2);
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <Card className="overflow-hidden bg-[rgb(var(--surface-1-rgb)/0.98)]">
                      <CardContent className="space-y-3 p-3">
                        <div className="h-[2px] w-full rounded-full bg-[image:var(--grad-primary)]" />
                        <div className="grid grid-cols-2 gap-2">
                          {photos.map((photo, i) => (
                            <Image
                              key={`${photo.url}-${i}`}
                              src={photo.url}
                              alt="duo"
                              width={500}
                              height={700}
                              className="h-36 w-full rounded-xl object-cover"
                              unoptimized
                            />
                          ))}
                        </div>

                        <p className="line-clamp-2 text-xs text-text2">{item.caption || "DUO-момент"}</p>

                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-text3">{new Date(item.created_at).toLocaleDateString("ru-RU")}</p>
                          <Button size="sm" variant="secondary">Смотреть</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="DUO пока нет" description="Пользователь еще не публиковал совместные DUO-записи." />
          )}
        </div>
      ) : null}

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogHeader>
          <DialogTitle>Зона знакомства</DialogTitle>
        </DialogHeader>

        <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1 text-sm">
          {connectData?.vibeStatus ? (
            <div className="rounded-full border border-[rgb(var(--teal-rgb)/0.32)] bg-[rgb(var(--teal-rgb)/0.12)] px-3 py-1 text-xs text-text">
              {connectData.vibeStatus}
            </div>
          ) : null}

          {connectData?.profileSummary ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.76)] p-3 text-text2">
              {connectData.profileSummary}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
            <p className="text-xs text-text3">Тема</p>
            <p className="font-medium text-text">{connectData?.topic}</p>
          </div>

          {(connectData?.firstMessages ?? []).length
            ? connectData?.firstMessages?.map((m: string) => (
                <div key={m} className="rounded-2xl border border-[rgb(var(--sky-rgb)/0.26)] bg-[rgb(var(--sky-rgb)/0.1)] p-3 text-[13px] text-text">
                  {m}
                </div>
              ))
            : null}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
            <p className="mb-1 text-xs text-text3">Контрольный вопрос</p>
            <p className="text-text">{connectData?.question}</p>
          </div>
        </div>
      </Dialog>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogHeader>
          <DialogTitle>Дополнительно</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => toast.message("Скоро", { description: "Жалоба и блокировка будут здесь." })}>
            Пожаловаться
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => toast.message("Скоро", { description: "Сохранение профиля в избранное будет здесь." })}>
            Сохранить профиль
          </Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
