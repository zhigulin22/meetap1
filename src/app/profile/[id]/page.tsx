"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
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

          <div className="rounded-full border border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.16)] px-3 py-1 text-xs text-[rgb(var(--text-rgb))]">
            Статус: {data.status}
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

          <div className="rounded-2xl border border-[rgb(var(--success-rgb)/0.35)] bg-[rgb(var(--success-rgb)/0.14)] p-3 text-xs text-[rgb(var(--text-rgb))]">
            Плюс системы: {data.positiveFact}
          </div>

          <p className="text-sm text-text2">Интересы: {(p.interests || []).join(", ") || "Не заполнено"}</p>
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
