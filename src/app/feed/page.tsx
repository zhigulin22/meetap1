"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { DailyDuoDialog } from "@/components/daily-duo-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type FeedPost = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
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
      user: {
        id: `demo-user-${idx}`,
        name: `Demo User ${String(idx + 1).padStart(2, "0")}`,
        avatar_url: `https://placehold.co/200x200?text=${idx + 1}`,
      },
      photos: duo
        ? {
            front: `https://placehold.co/700x900?text=DUO+${idx + 1}A`,
            back: `https://placehold.co/700x900?text=DUO+${idx + 1}B`,
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

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", commentsPost?.id],
    queryFn: () => api<{ items: CommentItem[] }>(`/api/feed/posts/${commentsPost?.id}/comments`),
    enabled: Boolean(commentsPost?.id && commentsOpen && !String(commentsPost?.id).startsWith("demo-")),
    refetchInterval: commentsOpen ? 2500 : false,
  });

  const sourceItems = useMemo(() => {
    const realItems = data?.items ?? [];
    if (realItems.length) return realItems;
    if (process.env.NODE_ENV !== "production") return demoFeed();
    return [];
  }, [data?.items]);

  const filtered = useMemo(() => {
    if (mode === "all") return sourceItems;
    return sourceItems.filter((item) => mediaKind(item) === mode);
  }, [sourceItems, mode]);

  useEffect(() => {
    if (!commentsOpen) return;
    commentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commentsOpen, commentsData?.items?.length]);

  async function react(postId: string, reactionType: "like" | "star") {
    if (postId.startsWith("demo-")) return;
    try {
      await api(`/api/feed/posts/${postId}/react`, {
        method: "POST",
        body: JSON.stringify({ reactionType }),
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка реакции");
    }
  }

  async function connect(post: FeedPost) {
    if (!post.user?.id || post.id.startsWith("demo-")) {
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
      <TopBar
        title="Лента"
        subtitle="Свежие посты и DUO в спокойной премиальной подаче"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="teal">DUO</Pill>
            <Button size="icon" onClick={() => setCreateOpen(true)} aria-label="Создать пост">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-3 rounded-[14px] bg-[rgb(var(--surface-2-rgb)/0.88)] p-1">
        <SegmentedTabs
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All" },
            { value: "video", label: "Video" },
            { value: "single", label: "Single" },
            { value: "duo", label: "Duo" },
          ]}
          className="w-full"
        />
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
          <p>DUO с двумя фото лица помогает алгоритму точнее рекомендовать людей и события.</p>
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
            {commentsLoading ? <Skeleton className="h-16 w-full" /> : null}
            {(commentsData?.items ?? []).map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.76)] p-3">
                <p className="text-xs text-muted">{comment.user?.name ?? "Пользователь"}</p>
                <p className="text-sm leading-5">{comment.content}</p>
              </div>
            ))}
            {!commentsLoading && !(commentsData?.items ?? []).length ? <p className="text-sm text-muted">Пока нет комментариев</p> : null}
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
            description="Разблокируй ленту, сделав DUO: 2 фото с лицами."
            hint="Чеклист без давления: это улучшает рекомендации и качество знакомств."
            cta={{ label: "Сделать DUO", onClick: () => setCreateOpen(true) }}
            secondary={{ label: "Почему так?", onClick: () => setWhyOpen(true) }}
          />
        </motion.div>
      ) : null}

      {!isLoading && !data?.locked ? (
        <div className="feed-scroll snap-y snap-mandatory space-y-3 overflow-y-auto pb-24">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} onReact={react} onConnect={connect} onOpenComments={openComments} />
          ))}
          {!filtered.length ? (
            <EmptyState
              title="Пустой фильтр"
              description="По выбранному режиму пока нет постов."
              hint="Смени вкладку или добавь новый контент."
              cta={{ label: "Создать DUO", onClick: () => setCreateOpen(true) }}
            />
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
