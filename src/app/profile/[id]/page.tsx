"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronDown,
  HeartHandshake,
  Images,
  MapPin,
  MessageCircle,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

type PostItem = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
  photos: Array<{ kind: string; url: string }>;
};

type Compatibility = {
  score: number;
  reasons: string[];
  common: string[];
} | null;

type CommonEvent = {
  id: string;
  title?: string;
  city?: string;
  starts_at?: string;
  cover_url?: string | null;
  image_url?: string | null;
};

type CommonPerson = {
  id: string;
  name?: string;
  avatar_url?: string | null;
  interests?: string[] | null;
};

const tabs = ["all", "duo", "photos", "videos", "events"] as const;

type TabKey = (typeof tabs)[number];

type TabLabel = { key: TabKey; label: string };
const tabLabels: TabLabel[] = [
  { key: "all", label: "Все" },
  { key: "duo", label: "DUO" },
  { key: "photos", label: "Фото" },
  { key: "videos", label: "Видео" },
  { key: "events", label: "События" },
];

function humanGoal(profile: any) {
  const prefs = profile?.preferences ?? {};
  return prefs.goal || prefs.intent || prefs.purpose || prefs.dating_goal || "";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function isVideoUrl(url?: string) {
  return Boolean(url?.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) || Boolean(url?.includes("/video"));
}

function postCover(post: PostItem) {
  if (!post.photos?.length) return "https://placehold.co/600x800";
  const cover = post.photos.find((p) => p.kind === "cover")?.url;
  return cover || post.photos[0]?.url || "https://placehold.co/600x800";
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [showWhy, setShowWhy] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", params.id],
    queryFn: () =>
      api<{
        profile: any;
        stats: { followers: number; publications: number; events: number };
        status: string;
        positiveFact: string;
        content: { all: PostItem[]; videos: PostItem[]; photos: PostItem[] };
        privacy_settings?: Record<string, any>;
        compatibility?: Compatibility;
        common_events?: CommonEvent[];
        common_people?: CommonPerson[];
      }>(`/api/profile/${params.id}`),
  });

  const content = data?.content ?? { all: [], videos: [], photos: [] };

  const allItems = useMemo(() => content.all ?? [], [content]);
  const mediaItems = useMemo(() => {
    if (!content) return [] as PostItem[];
    if (tab === "all") return content.all;
    if (tab === "duo") return content.all.filter((p) => p.type === "daily_duo");
    if (tab === "videos") return content.all.filter((p) => p.photos?.some((ph) => isVideoUrl(ph.url)));
    return content.all.filter((p) => !p.photos?.some((ph) => isVideoUrl(ph.url)));
  }, [content, tab]);

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
  const privacy = data.privacy_settings ?? {};
  const compat = data.compatibility ?? null;
  const facts = Array.isArray(p.facts) ? p.facts.filter(Boolean) : [];
  const interests = Array.isArray(p.interests) ? p.interests.filter(Boolean) : [];
  const commonEvents = data.common_events ?? [];
  const commonPeople = data.common_people ?? [];
  const goal = humanGoal(p);
  const psych = p.personality_profile ?? null;
  const quote = p.preferences?.quote ?? "";
  const showQuote = privacy.show_quote !== false && Boolean(quote);
  const showPsychotype = privacy.show_psychotype !== false && Boolean(psych?.style);
  const university = p.student_verified ? p.student_university || p.university : null;
  const about = (p.bio ?? "").trim();
  const showAbout = Boolean(about);
  const keyInterests = interests.filter((i: string) => typeof i === "string" && i.trim().length > 1).slice(0, 8);
  const showInterests = privacy.show_interests !== false && keyInterests.length > 0;
  const showFacts = privacy.show_facts !== false && facts.length > 0;
  const duoCount = allItems.filter((post) => post.type === "daily_duo").length;
  const icebreakers = [
    ...(compat?.common?.slice(0, 2) ?? []),
    ...commonEvents.slice(0, 1).map((ev) => `Событие: ${ev.title || "Без названия"}`),
  ].filter(Boolean);

  async function handleConnect() {
    try {
      await api("/api/contacts/connect", { method: "POST", body: JSON.stringify({ targetUserId: p.id }) });
      toast.success("Запрос отправлен. Открываем чат.");
      router.push(`/chats/${p.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить запрос");
    }
  }

  function openPost(post: PostItem, index = 0) {
    setSelectedPost(post);
    setSelectedIndex(index);
  }

  const selectedMedia = selectedPost?.photos ?? [];
  const currentMedia = selectedMedia[selectedIndex]?.url;

  return (
    <PageShell>
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[36px] border border-[color:var(--border-strong)] bg-[linear-gradient(160deg,rgba(22,30,62,0.96),rgba(14,20,44,0.98))] shadow-card">
          <CardContent className="relative space-y-5 p-6">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.26),transparent_70%)] blur-3xl" />

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-36 w-36 rounded-full p-[3px]" style={{ background: "var(--grad-primary)" }}>
                  <div className="rounded-full bg-[rgb(var(--surface-1-rgb))] p-[2px]">
                    <Image
                      src={p.avatar_url || "https://placehold.co/260"}
                      alt={p.name}
                      width={160}
                      height={160}
                      className="h-32 w-32 rounded-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-text">{p.name}</h1>
                    {p.username ? <span className="text-xs text-text3">@{p.username}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text2">
                    {privacy.show_city === false || !p.city ? null : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] px-2 py-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {p.city}
                      </span>
                    )}
                    {privacy.show_work === false || !p.work ? null : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] px-2 py-0.5">
                        {p.work}
                      </span>
                    )}
                    {privacy.show_university === false || !university ? null : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.4)] bg-[rgb(var(--violet-rgb)/0.18)] px-2 py-0.5 text-text">
                        🎓 {university} · подтверждено
                      </span>
                    )}
                  </div>
                  {keyInterests.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {keyInterests.map((interest: string) => (
                        <span key={interest} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2 py-0.5 text-[11px] text-text2">
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleConnect} className="h-12 px-6">
                  <HeartHandshake className="mr-2 h-4 w-4" /> Познакомиться
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/chats/${p.id}`)} className="h-12 px-6">
                  <MessageCircle className="mr-2 h-4 w-4" /> Написать
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/events?invite=${p.id}`)} className="h-12 px-6">
                  Пригласить на событие
                </Button>
              </div>
            </div>

            {(goal || showPsychotype) ? (
              <div className="grid gap-2 md:grid-cols-2">
                {goal ? (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                    <p className="text-xs text-text3">Цель знакомства</p>
                    <p className="mt-1 text-sm text-text">{goal}</p>
                  </div>
                ) : null}
                {showPsychotype ? (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                    <p className="text-xs text-text3">Краткий психотип</p>
                    <p className="mt-1 text-sm text-text">{psych.style}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showQuote ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3 text-sm text-text">
                {quote}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {showAbout ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-text">О себе</p>
              <p className="mt-1 line-clamp-3 text-sm text-text2">{about}</p>
            </CardContent>
          </Card>
        ) : null}

        {showFacts ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-text">Факты</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {facts.slice(0, 6).map((fact: string) => (
                  <span key={fact} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2.5 py-1 text-xs text-text2">
                    {fact}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {compat ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text3">Совместимость</p>
                  <p className="text-2xl font-semibold text-text">{compat.score}%</p>
                </div>
                <Button variant="secondary" onClick={() => setShowWhy((v) => !v)}>
                  Почему мы совпали <ChevronDown className={`ml-2 h-4 w-4 transition ${showWhy ? "rotate-180" : ""}`} />
                </Button>
              </div>
              {showWhy ? (
                <div className="flex flex-wrap gap-2">
                  {compat.reasons.map((reason: string) => (
                    <span
                      key={reason}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2 py-0.5 text-[11px] text-text2"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
              {compat.common?.length ? (
                <p className="text-xs text-text2">Общие интересы: {compat.common.slice(0, 4).join(", ")}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {icebreakers.length ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-text">Повод написать</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {icebreakers.slice(0, 3).map((item) => (
                  <span key={item} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2.5 py-1 text-xs text-text2">
                    {item}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {(duoCount || data.stats.events || commonEvents.length || commonPeople.length) ? (
          <div className="grid gap-2 md:grid-cols-2">
            {duoCount ? (
              <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--violet-rgb)/0.2)] text-[rgb(var(--violet-rgb))]">
                    <Images className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">DUO</p>
                    <p className="text-xs text-text2">{duoCount} публикаций</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {data.stats.events ? (
              <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--sky-rgb)/0.2)] text-[rgb(var(--sky-rgb))]">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">События</p>
                    <p className="text-xs text-text2">Посетил(а) {data.stats.events}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {commonEvents.length ? (
              <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-text">Общие события</p>
                  <div className="mt-2 space-y-2">
                    {commonEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => router.push(`/events/${ev.id}`)}
                        className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.82)] px-3 py-2 text-left text-xs text-text2"
                      >
                        <span className="truncate">{ev.title || "Событие"}</span>
                        <span className="text-text3">{formatDate(ev.starts_at)}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {commonPeople.length ? (
              <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-text">Общие люди</p>
                  <div className="mt-3 flex -space-x-2">
                    {commonPeople.slice(0, 6).map((person) => (
                      <Image
                        key={person.id}
                        src={person.avatar_url || "https://placehold.co/80"}
                        alt={person.name || "Человек"}
                        width={64}
                        height={64}
                        className="h-9 w-9 rounded-full border border-[color:var(--border-soft)] object-cover"
                        unoptimized
                      />
                    ))}
                    {commonPeople.length > 6 ? <span className="ml-3 text-xs text-text3">+{commonPeople.length - 6}</span> : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {showInterests ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-text">Интересы</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyInterests.map((interest: string) => (
                  <span key={interest} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2.5 py-1 text-xs text-text2">
                    {interest}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)]">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Контент</p>
              <div className="flex gap-2">
                {tabLabels.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      tab === item.key
                        ? "border-[rgb(var(--violet-rgb)/0.55)] bg-[rgb(var(--violet-rgb)/0.2)] text-text"
                        : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] text-text2"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {mediaItems.length ? (
              <div className="grid grid-cols-2 gap-3">
                {mediaItems.map((post) => {
                  const cover = postCover(post);
                  const isVideo = post.photos?.some((ph) => isVideoUrl(ph.url));
                  const count = post.photos?.length ?? 0;
                  const isDuo = post.type === "daily_duo";
                  const duoShots = post.photos?.slice(0, 2) ?? [];
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => openPost(post, 0)}
                      className={`relative overflow-hidden rounded-2xl border ${isDuo ? "border-[rgb(var(--violet-rgb)/0.55)] shadow-[0_12px_24px_rgba(118,84,255,0.25)]" : "border-[color:var(--border-soft)]"} bg-[rgb(var(--surface-1-rgb)/0.9)]`}
                    >
                      {isDuo && duoShots.length >= 2 ? (
                        <div className="grid h-48 w-full grid-cols-2">
                          <Image src={duoShots[0].url} alt="duo-1" width={240} height={320} className="h-full w-full object-cover" unoptimized />
                          <Image src={duoShots[1].url} alt="duo-2" width={240} height={320} className="h-full w-full object-cover" unoptimized />
                        </div>
                      ) : (
                        <Image src={cover} alt="media" width={480} height={640} className="h-48 w-full object-cover" unoptimized />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute left-2 top-2 flex gap-1">
                        {post.type === "daily_duo" ? (
                          <span className="rounded-full border border-[rgb(var(--violet-rgb)/0.6)] bg-[rgb(var(--violet-rgb)/0.65)] px-2 py-0.5 text-[10px] text-white">DUO</span>
                        ) : null}
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[10px] text-white">
                        {isVideo ? <Play className="h-3 w-3" /> : null}
                        {count > 1 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5">
                            <Images className="h-3 w-3" /> {count}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-4 text-center text-xs text-text2">
                Контента пока нет
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => (open ? undefined : setSelectedPost(null))}>
        <DialogHeader>
          <DialogTitle>Пост</DialogTitle>
        </DialogHeader>
        {selectedPost ? (
          <div className="space-y-3">
            {currentMedia ? (
              <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)]">
                <Image src={currentMedia} alt="media" width={960} height={1200} className="h-[60vh] w-full object-cover" unoptimized />
              </div>
            ) : null}
            {selectedMedia.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto">
                {selectedMedia.map((media, idx) => (
                  <button
                    key={`${media.url}-${idx}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`h-16 w-16 overflow-hidden rounded-xl border ${
                      idx == selectedIndex ? "border-[rgb(var(--violet-rgb)/0.6)]" : "border-[color:var(--border-soft)]"
                    }`}
                  >
                    <Image src={media.url} alt="thumb" width={120} height={120} className="h-full w-full object-cover" unoptimized />
                  </button>
                ))}
              </div>
            ) : null}
            {selectedPost.caption ? <p className="text-sm text-text2">{selectedPost.caption}</p> : null}
            <div className="text-xs text-text3">{new Date(selectedPost.created_at).toLocaleString("ru-RU")}</div>
          </div>
        ) : null}
      </Dialog>
    </PageShell>
  );
}
