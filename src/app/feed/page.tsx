"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { DailyDuoDialog } from "@/components/daily-duo-dialog";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function FeedPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"all" | "video" | "duo" | "single">("all");
  const [createOpen, setCreateOpen] = useState(false);

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
    enabled: Boolean(commentsPost?.id && commentsOpen),
    refetchInterval: commentsOpen ? 2500 : false,
  });

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (mode === "all") return items;
    return items.filter((item) => mediaKind(item) === mode);
  }, [data, mode]);

  useEffect(() => {
    if (!commentsOpen) return;
    commentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commentsOpen, commentsData?.items?.length]);

  async function react(postId: string, reactionType: "like" | "star") {
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
    if (!post.user?.id) {
      toast.error("Профиль автора недоступен");
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
    if (!commentsPost?.id || !commentInput.trim()) return;

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
      <div className="mb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Лента</h1>
            <p className="text-xs text-muted">Свайпай вверх: видео, одиночные фото и Daily Duo</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            DUO
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "video", "single", "duo"].map((x) => (
            <button
              key={x}
              onClick={() => setMode(x as typeof mode)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                mode === x ? "border-action bg-action/20 text-action" : "border-border bg-white/5 text-muted"
              }`}
            >
              {x === "all" ? "all" : x}
            </button>
          ))}
        </div>
      </div>

      <DailyDuoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["feed"] })}
      />

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogHeader>
          <DialogTitle>Зона знакомства: {connectData?.targetName}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1 text-sm">
          {connectData?.insight.vibeStatus ? (
            <div className="rounded-full border border-[#52cc83]/40 bg-[#52cc83]/15 px-3 py-1 text-xs text-[#aef0c8]">
              {connectData.insight.vibeStatus}
            </div>
          ) : null}

          {connectData?.insight.profileSummary ? (
            <div className="rounded-2xl border border-border bg-white/5 p-3 text-muted">
              {connectData.insight.profileSummary}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-black/20 p-3">
            <p className="text-xs text-muted">Тема</p>
            <p className="font-medium">{connectData?.insight.topic}</p>
          </div>

          {(connectData?.insight.firstMessages ?? []).length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium">Варианты первого сообщения</p>
              {connectData?.insight.firstMessages?.map((m) => (
                <div key={m} className="rounded-2xl border border-[#8eb8ff]/40 bg-[#8eb8ff]/10 p-3 text-[13px]">
                  {m}
                </div>
              ))}
            </div>
          ) : null}

          {(connectData?.insight.approachTips ?? []).length ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">Как лучше подойти</p>
              {connectData?.insight.approachTips?.map((tip) => (
                <p key={tip} className="text-xs text-muted">• {tip}</p>
              ))}
            </div>
          ) : null}

          {(connectData?.insight.offlineIdeas ?? []).length ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">Оффлайн сценарии</p>
              {connectData?.insight.offlineIdeas?.map((tip) => (
                <p key={tip} className="text-xs text-muted">• {tip}</p>
              ))}
            </div>
          ) : null}

          {(connectData?.insight.onlineIdeas ?? []).length ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">Онлайн сценарии</p>
              {connectData?.insight.onlineIdeas?.map((tip) => (
                <p key={tip} className="text-xs text-muted">• {tip}</p>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-black/20 p-3">
            <p className="mb-1 text-xs text-muted">Контрольный вопрос</p>
            <p>{connectData?.insight.question}</p>
          </div>

          {(connectData?.insight.sharedSignals ?? []).length ? (
            <div className="rounded-2xl border border-border bg-black/20 p-3">
              <p className="mb-1 text-xs text-muted">Сигналы, на которых основана подсказка</p>
              <p className="text-xs text-muted">{connectData?.insight.sharedSignals?.join(" · ")}</p>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogHeader>
          <DialogTitle>Комментарии</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-black/15 p-2 pr-1">
            {commentsLoading ? <Skeleton className="h-16 w-full" /> : null}
            {(commentsData?.items ?? []).map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-border/80 bg-white/5 p-3">
                <p className="text-xs text-muted">{comment.user?.name ?? "Пользователь"}</p>
                <p className="text-sm leading-5">{comment.content}</p>
              </div>
            ))}
            {!commentsLoading && !(commentsData?.items ?? []).length ? (
              <p className="text-sm text-muted">Пока нет комментариев</p>
            ) : null}
            <div ref={commentsBottomRef} />
          </div>

          <div className="flex gap-2">
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Напиши комментарий"
            />
            <Button onClick={sendComment}>Отправить</Button>
          </div>
        </div>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[68vh] w-full rounded-[26px]" />
          <Skeleton className="h-[68vh] w-full rounded-[26px]" />
        </div>
      ) : null}

      {!isLoading && data?.locked ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="overflow-hidden rounded-[24px]">
            <CardContent className="space-y-4 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-action/35 bg-action/15 text-action">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-semibold">Лента закрыта</h2>
              <p className="text-sm text-muted">Если не было публикаций больше 7 дней, нужно добавить новый Daily Duo.</p>
              <Button onClick={() => setCreateOpen(true)} className="w-full">
                Выложить фото
              </Button>
            </CardContent>
          </Card>
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
            <Card>
              <CardContent className="p-4 text-sm text-muted">По этому фильтру пока нет постов.</CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
