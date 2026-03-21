"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { DailyDuoDialog } from "@/components/daily-duo-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type FeedPost = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
  is_mine: boolean;
  user: { id: string; name: string; avatar_url: string | null } | null;
  photos: { front?: string; back?: string; cover?: string };
  reactions: { like: number; connect: number; star: number };
  viewer: { liked: boolean; connected: boolean; starred: boolean };
  comments_count: number;
};

type FeedResponse = {
  locked: boolean;
  items: FeedPost[];
};

type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  user: { id: string; name: string; avatar_url: string | null } | null;
};

type ConnectInsight = {
  messages: string[];
  topic: string;
  question: string;
  vibeStatus?: string;
  profileSummary?: string;
  firstMessages?: string[];
  approachTips?: string[];
  offlineIdeas?: string[];
  onlineIdeas?: string[];
  sharedSignals?: string[];
};

function mediaKind(post: FeedPost) {
  if (post.type === "daily_duo") return "duo";
  const media = post.photos.cover || post.photos.front || post.photos.back;
  const video = Boolean(media?.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) || Boolean(media?.includes("/video"));
  return video ? "video" : "single";
}

function demoFeed(): FeedPost[] {
  return Array.from({ length: 10 }).map((_, idx) => {
    const even = idx % 2 === 0;
    const duo = idx % 3 === 0;
    return {
      id: `demo-${idx}`,
      type: duo ? "daily_duo" : "reel",
      caption: duo
        ? "DUO-запись для демо. #нетворкинг #встречи"
        : even
        ? "Короткий демо-видео пост для проверки ритма карточек."
        : "Фото-пост с аккуратной подписью и CTA.",
      created_at: new Date(Date.now() - idx * 90 * 60 * 1000).toISOString(),
      is_mine: false,
      user: {
        id: `demo-user-${idx}`,
        name: `Demo User ${String(idx + 1).padStart(2, "0")}`,
        avatar_url: `https://placehold.co/200x200?text=${idx + 1}`,
      },
      photos: duo
        ? {
            front: `https://placehold.co/1200x1600?text=DUO+${idx + 1}`,
          }
        : {
            cover: even
              ? `https://www.w3schools.com/html/mov_bbb.mp4`
              : `https://placehold.co/1200x1600?text=PHOTO+${idx + 1}`,
          },
      reactions: { like: 6 + idx, connect: 2 + Math.floor(idx / 2), star: 1 + (idx % 4) },
      viewer: { liked: false, connected: false, starred: false },
      comments_count: idx % 5,
    };
  });
}

export default function FeedPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"all" | "video" | "duo" | "single">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectData, setConnectData] = useState<{ targetName: string; insight: ConnectInsight } | null>(null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const commentsBottomRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => api<FeedResponse>("/api/feed/posts"),
  });

  const items = data?.items?.length ? data.items : demoFeed();
  const filtered = useMemo(() => {
    if (mode === "all") return items;
    return items.filter((post) => mediaKind(post) === mode);
  }, [items, mode]);

  const commentsQuery = useQuery({
    queryKey: ["comments", commentsPost?.id],
    queryFn: () => api<{ items: CommentItem[] }>(`/api/feed/posts/${commentsPost?.id}/comments`),
    enabled: Boolean(commentsPost?.id) && !commentsPost?.id?.startsWith("demo-"),
  });

  useEffect(() => {
    if (commentsBottomRef.current) {
      commentsBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [commentsQuery.data]);

  async function react(postId: string, reactionType: "like" | "star") {
    const post = items.find((item) => item.id === postId);
    if (!post) return;

    if (post.id.startsWith("demo-")) {
      toast.message("Демо-карточка", { description: "В проде здесь откроется реальный flow знакомства." });
      return;
    }

    try {
      await api(`/api/feed/posts/${post.id}/react`, {
        method: "POST",
        body: JSON.stringify({ reactionType }),
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось обновить реакцию");
    }
  }

  async function connect(post: FeedPost) {
    if (!post.user || post.id.startsWith("demo-")) {
      toast.message("Демо-карточка", { description: "В проде здесь откроется реальный flow знакомства." });
      return;
    }

    try {
      await api(`/api/feed/posts/${post.id}/react`, {
        method: "POST",
        body: JSON.stringify({ reactionType: "connect" }),
      });

      const res = await api<{ icebreaker: ConnectInsight }>("/api/contacts/connect", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: post.user.id,
          context: `Пост в ленте: ${post.caption ?? "без подписи"}`,
        }),
      });

      setConnectData({ targetName: post.user.name, insight: res.icebreaker });
      setConnectOpen(true);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сформировать инсайт");
    }
  }

  function openComments(post: FeedPost) {
    setCommentsPost(post);
    setCommentsOpen(true);
  }

  function openDm(post: FeedPost) {
    if (!post.user?.id) {
      toast.error("Профиль автора недоступен");
      return;
    }
    if (post.is_mine) {
      toast.error("Нельзя писать самому себе");
      return;
    }
    router.push(`/chats/${post.user.id}`);
  }

  async function sendComment() {
    if (!commentsPost?.id || !commentInput.trim() || commentsPost.id.startsWith("demo-")) return;

    try {
      await api(`/api/feed/posts/${commentsPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      setCommentInput("");
      queryClient.invalidateQueries({ queryKey: ["comments", commentsPost.id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить комментарий");
    }
  }

  return (
    <PageShell>
      <div className="mb-4 rounded-[36px] bg-[linear-gradient(180deg,rgba(18,24,50,0.96),rgba(10,14,30,0.98))] p-6 shadow-[0_30px_70px_rgba(7,10,26,0.7)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-text">Лента</h1>
            <p className="text-[15px] text-text2">Живые моменты и реальные знакомства</p>
          </div>
          <Button size="lg" onClick={() => setCreateOpen(true)} className="rounded-full px-7 text-[15px] shadow-[0_18px_34px_rgba(122,84,255,0.55)]">
            <Plus className="mr-1 h-4 w-4" /> Создать DUO
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-4">
            <div className="flex items-center justify-between text-xs text-text2">
              <span>Прогресс недели</span>
              <span>68%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-3-rgb)/0.9)]">
              <div className="h-full rounded-full bg-[image:var(--grad-primary)]" style={{ width: "68%" }} />
            </div>
            <p className="mt-2 text-[11px] text-text3">2 DUO, 3 события, 5 реакций до следующего уровня.</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text2">Ежедневный DUO</p>
                <p className="text-sm font-semibold text-text">Снять DUO сегодня</p>
              </div>
              <span className="rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.2)] px-2 py-1 text-[11px] text-text">🔥 Серия 3 дня</span>
            </div>
            <Button variant="secondary" className="mt-3 h-9" onClick={() => setCreateOpen(true)}>
              Открыть DUO
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { value: "all", label: "Все" },
            { value: "duo", label: "DUO" },
            { value: "video", label: "Видео" },
            { value: "single", label: "Фото" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setMode(tab.value as any)}
              className={`h-11 rounded-full px-6 text-[14px] font-semibold transition active:scale-[0.98] ${
                mode === tab.value
                  ? "bg-[image:var(--grad-primary)] text-white shadow-[0_14px_30px_rgba(122,84,255,0.5)]"
                  : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-[28px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)] p-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] p-4">
          <p className="text-xs text-text3">DUO — фирменный формат MeetAp</p>
          <p className="mt-1 text-sm text-text">Фото с живым контекстом повышает доверие и совместимость.</p>
          <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Сделать фото</Button>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] p-4">
          <p className="text-xs text-text3">Почему это важно</p>
          <p className="mt-1 text-sm text-text">Лента фиксирует реальные встречи и помогает понять человека.</p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setWhyOpen(true)}>Подробнее</Button>
        </div>
      </div>

      <DailyDuoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["feed"] })}
      />

      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <DialogHeader>
          <DialogTitle>Почему лента может быть закрыта</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-text2">
          <p>Лента временно закрывается, если давно не было публикаций.</p>
          <p>Если на фото два человека, алгоритм точнее рекомендует людей и события.</p>
          <p className="text-xs text-text3">Это не штраф, а мягкий чеклист для качества рекомендаций.</p>
        </div>
      </Dialog>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogHeader>
          <DialogTitle>Зона знакомства: {connectData?.targetName}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1 text-sm">
          {connectData?.insight.vibeStatus ? (
            <div className="rounded-full border border-mint/40 bg-mint/14 px-3 py-1 text-xs text-mint/90">{connectData.insight.vibeStatus}</div>
          ) : null}

          {connectData?.insight.profileSummary ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.76)] p-3 text-muted">{connectData.insight.profileSummary}</div>
          ) : null}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
            <p className="text-xs text-muted">Тема</p>
            <p className="font-medium">{connectData?.insight.topic}</p>
          </div>

          {(connectData?.insight.firstMessages ?? []).length
            ? connectData?.insight.firstMessages?.map((m) => (
                <div key={m} className="rounded-2xl border border-cyan/35 bg-[rgb(var(--sky-rgb)/0.12)] p-3 text-[13px]">
                  {m}
                </div>
              ))
            : null}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.72)] p-3">
            <p className="mb-1 text-xs text-muted">Контрольный вопрос</p>
            <p>{connectData?.insight.question}</p>
          </div>
        </div>
      </Dialog>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogHeader>
          <DialogTitle>Комментарии</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.68)] p-2 pr-1">
            {commentsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
            {(commentsQuery.data?.items ?? []).map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.76)] p-3">
                <p className="text-xs text-muted">{comment.user?.name ?? "Пользователь"}</p>
                <p className="text-sm leading-5">{comment.content}</p>
              </div>
            ))}
            {!commentsQuery.isLoading && !(commentsQuery.data?.items ?? []).length ? <p className="text-sm text-muted">Пока нет комментариев</p> : null}
            <div ref={commentsBottomRef} />
          </div>

          <div className="flex gap-2">
            <Input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Напиши комментарий" />
            <Button onClick={sendComment}>Отправить</Button>
          </div>
        </div>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[48vh] w-full rounded-[24px]" />
          <Skeleton className="h-[48vh] w-full rounded-[24px]" />
        </div>
      ) : null}

      {!isLoading && data?.locked ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <EmptyState
            title="Лента закрыта"
            description="Разблокируй ленту, сделав фото. Бонус будет, если на фото два человека."
            hint="Чеклист без давления: это улучшает рекомендации и качество знакомств."
            cta={{ label: "Сделать фото", onClick: () => setCreateOpen(true) }}
            secondary={{ label: "Почему так?", onClick: () => setWhyOpen(true) }}
          />
        </motion.div>
      ) : null}

      {!isLoading && !data?.locked ? (
        <div className="feed-scroll snap-y snap-mandatory space-y-3 overflow-y-auto pb-24">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReact={react}
              onConnect={connect}
              onMessage={openDm}
              onOpenComments={openComments}
            />
          ))}
          {!filtered.length ? (
            <EmptyState
              title="Пустой фильтр"
              description="По выбранному режиму пока нет постов."
              hint="Смени вкладку или добавь новый контент."
              cta={{ label: "Создать фото", onClick: () => setCreateOpen(true) }}
            />
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
