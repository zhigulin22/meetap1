"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ChevronDown } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<"all" | "videos" | "photos">("all");
  const [showWhy, setShowWhy] = useState(false);

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

  const list = useMemo(() => {
    if (!data) return [] as PostItem[];
    if (tab === "videos") return data.content.videos;
    if (tab === "photos") return data.content.photos;
    return data.content.all;
  }, [data, tab]);

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-56 w-full rounded-3xl" />
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
  const facts = Array.isArray(p.facts) ? p.facts : [];
  const interests = Array.isArray(p.interests) ? p.interests : [];
  const commonEvents = data.common_events ?? [];
  const commonPeople = data.common_people ?? [];
  const goal = humanGoal(p);
  const psych = p.personality_profile ?? null;
  const traits = psych?.traits ?? null;

  return (
    <PageShell>
      <Card className="mb-3 overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)] shadow-card">
        <CardContent className="relative space-y-4 p-5">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.22),transparent_70%)] blur-3xl" />

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative h-36 w-36 rounded-full p-[3px]" style={{ background: "var(--grad-primary)" }}>
              <div className="rounded-full bg-[rgb(var(--surface-1-rgb))] p-[2px]">
                <Image
                  src={p.avatar_url || "https://placehold.co/240"}
                  alt={p.name}
                  width={144}
                  height={144}
                  className="h-32 w-32 rounded-full object-cover"
                  unoptimized
                />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-text">{p.name}</h1>
              {p.work ? <p className="text-sm text-text2">{p.work}</p> : null}
              {p.university ? <p className="text-xs text-text3">{p.university}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.16)] px-3 py-1 text-xs text-[rgb(var(--text-rgb))]">
              Статус: {data.status}
            </div>
            {p.student_verified ? (
              <div className="rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.2)] px-3 py-1 text-xs text-text">
                Студент подтверждён
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-2 text-center">
              <p className="text-sm font-semibold text-text">{data.stats.followers}</p>
              <p className="text-[11px] text-text3">подписчиков</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-2 text-center">
              <p className="text-sm font-semibold text-text">{data.stats.publications}</p>
              <p className="text-[11px] text-text3">публикаций</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-2 text-center">
              <p className="text-sm font-semibold text-text">{data.stats.events}</p>
              <p className="text-[11px] text-text3">ивентов</p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-3">
              <p className="text-xs text-text3">Цель знакомства</p>
              <p className="mt-1 text-sm text-text">{goal || "Не указано"}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-3">
              <p className="text-xs text-text3">Формат общения</p>
              <p className="mt-1 text-sm text-text">{psych?.style || "Не указан"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--success-rgb)/0.35)] bg-[rgb(var(--success-rgb)/0.14)] p-3 text-xs text-[rgb(var(--text-rgb))]">
            Плюс системы: {data.positiveFact}
          </div>

          {compat ? (
            <div className="rounded-2xl border border-[rgb(var(--violet-rgb)/0.35)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-text3">Совместимость</p>
                  <p className="text-2xl font-semibold text-text">{compat.score}%</p>
                </div>
                <Button variant="secondary" className="gap-1" onClick={() => setShowWhy((v) => !v)}>
                  Почему мы совпали <ChevronDown className={`h-4 w-4 transition ${showWhy ? "rotate-180" : ""}`} />
                </Button>
              </div>
              {showWhy ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {compat.reasons.map((reason: string) => (
                    <span
                      key={reason}
                      className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.8)] px-2 py-0.5 text-[11px] text-text2"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {psych ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
              <p className="text-xs text-text3">Психопрофиль</p>
              <p className="mt-1 text-sm text-text">{psych.style}</p>
              {traits ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text2">
                  <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-1">Экстраверсия: {traits.extraversion}%</div>
                  <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-1">Открытость: {traits.openness}%</div>
                  <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-1">Надёжность: {traits.conscientiousness}%</div>
                  <div className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-1">Эмпатия: {traits.agreeableness}%</div>
                </div>
              ) : null}
              {Array.isArray(psych.recommendations) && psych.recommendations.length ? (
                <ul className="mt-2 space-y-1 text-xs text-text2">
                  {psych.recommendations.slice(0, 2).map((rec: string) => (
                    <li key={rec}>• {rec}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3 text-sm text-text2">
              Психопрофиль не заполнен
            </div>
          )}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
            <p className="text-xs text-text3">Факты</p>
            {privacy.show_facts === false ? (
              <p className="mt-1 text-sm text-text2">Скрыто пользователем</p>
            ) : facts.length ? (
              <ul className="mt-1 space-y-1 text-sm text-text2">
                {facts.map((fact: string, idx: number) => (
                  <li
                    key={`${idx}-${fact}`}
                    className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-1"
                  >
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-text2">Пока нет фактов</p>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
            <p className="text-xs text-text3">Интересы</p>
            {privacy.show_interests === false ? (
              <p className="mt-1 text-sm text-text2">Скрыто пользователем</p>
            ) : interests.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {interests.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.8)] px-2 py-0.5 text-[11px] text-text2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-text2">Интересы не заполнены</p>
            )}
          </div>

          {commonEvents.length ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
              <p className="text-xs text-text3">Общие события</p>
              <div className="mt-2 space-y-2">
                {commonEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] p-2">
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-[rgb(var(--surface-1-rgb))]">
                      {ev.cover_url || ev.image_url ? (
                        <img src={ev.cover_url || ev.image_url || ""} alt="event" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">{ev.title ?? "Событие"}</p>
                      <p className="text-xs text-text3">{formatDate(ev.starts_at)} · {ev.city ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {commonPeople.length ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
              <p className="text-xs text-text3">Общие люди</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {commonPeople.slice(0, 6).map((person) => (
                  <div key={person.id} className="flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.8)] px-2 py-1">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-[rgb(var(--surface-1-rgb))]">
                      {person.avatar_url ? <img src={person.avatar_url} alt={person.name ?? ""} className="h-full w-full object-cover" /> : null}
                    </div>
                    <span className="text-xs text-text2">{person.name ?? "Пользователь"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-2 grid grid-cols-3 gap-2">
        {[
          { id: "all", label: "Всё" },
          { id: "videos", label: "Видео" },
          { id: "photos", label: "Фото" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`w-full rounded-full border px-3 py-1.5 text-xs ${
              tab === t.id
                ? "border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] text-white shadow-[0_10px_20px_rgb(var(--violet-rgb)/0.2)]"
                : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] text-text2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-2">
        {list.map((post) => {
          const first = post.photos[0]?.url;

          return (
            <Card key={post.id} className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
              <CardContent className="space-y-2 p-3">
                {post.type === "reel" ? (
                  <video src={first} className="h-64 w-full rounded-2xl object-cover" controls playsInline />
                ) : (
                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl">
                    {post.photos.map((photo, idx) => (
                      <Image
                        key={`${post.id}-${idx}`}
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
                {post.caption ? <p className="text-sm text-text2">{post.caption}</p> : null}
              </CardContent>
            </Card>
          );
        })}
        {!list.length ? (
          <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <Sparkles className="h-6 w-6 text-[rgb(var(--violet-rgb))]" />
              <p className="text-sm font-semibold text-text">Постов пока нет</p>
              <p className="text-xs text-text2">Новые публикации появятся здесь, как только пользователь начнёт делиться контентом.</p>
              <Button variant="secondary">Создать пост</Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
