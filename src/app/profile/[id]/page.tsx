"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
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

  const { data, isLoading } = useQuery({
    queryKey: ["profile", params.id],
    queryFn: () =>
      api<{
        profile: any;
        stats: { followers: number; publications: number; events: number };
        status: string;
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

  return (
    <PageShell>
      <Card className="mb-3 overflow-hidden border-white/15 bg-surface/90 backdrop-blur-xl">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(10,18,60,0.95),rgba(82,204,131,0.3),rgba(90,125,255,0.45))]" />
        <CardContent className="space-y-4 p-4">
          <div className="-mt-10 flex items-end gap-3">
            <Image
              src={p.avatar_url || "https://placehold.co/120"}
              alt={p.name}
              width={120}
              height={120}
              className="h-20 w-20 rounded-3xl border-2 border-white/70 object-cover"
              unoptimized
            />
            <div className="pb-1">
              <h1 className="text-xl font-semibold">{p.name}</h1>
              <p className="text-xs text-muted">Level {p.level} · XP {p.xp}</p>
            </div>
          </div>

          <div className="rounded-full border border-[#8eb8ff]/40 bg-[#8eb8ff]/10 px-3 py-1 text-xs text-[#cfe0ff]">
            Статус: {data.status}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-black/10 p-2 text-center">
              <p className="text-sm font-semibold">{data.stats.followers}</p>
              <p className="text-[11px] text-muted">подписчиков</p>
            </div>
            <div className="rounded-2xl border border-border bg-black/10 p-2 text-center">
              <p className="text-sm font-semibold">{data.stats.publications}</p>
              <p className="text-[11px] text-muted">публикаций</p>
            </div>
            <div className="rounded-2xl border border-border bg-black/10 p-2 text-center">
              <p className="text-sm font-semibold">{data.stats.events}</p>
              <p className="text-[11px] text-muted">ивентов</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#52CC83]/35 bg-[#52CC83]/12 p-3 text-xs text-[#c8f7d8]">
            Плюс системы: {data.positiveFact}
          </div>

          <p className="text-sm text-muted">
            {p.university || "ВУЗ не указан"} · {p.work || "Работа не указана"}
          </p>
          <p className="text-sm text-muted">Интересы: {(p.interests || []).join(", ") || "Не заполнено"}</p>
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
              tab === t.id ? "border-action bg-action/20 text-action" : "border-border bg-white/5 text-muted"
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
            <Card key={post.id} className="overflow-hidden">
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
                {post.caption ? <p className="text-sm">{post.caption}</p> : null}
              </CardContent>
            </Card>
          );
        })}
        {!list.length ? <p className="text-sm text-muted">Публикаций пока нет</p> : null}
      </div>
    </PageShell>
  );
}
