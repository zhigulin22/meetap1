"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Handshake, MessageCircle, Play, Star, Volume2, VolumeX } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

type Post = {
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

function renderCaption(caption: string) {
  const parts = caption.split(/(@[\wа-яА-Я0-9_]+)/g);
  return (
    <p className="mt-2 text-sm leading-5 text-text2">
      {parts.map((part, idx) =>
        part.startsWith("@") ? (
          <span key={`${part}-${idx}`} className="font-medium text-cyan">
            {part}
          </span>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        ),
      )}
    </p>
  );
}

function isVideo(url: string | undefined) {
  return Boolean(url?.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) || Boolean(url?.includes("/video"));
}

function ActionIcon({
  icon,
  count,
  active,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "tap-press inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs text-text2 transition",
        active
          ? "border-[rgb(var(--teal-rgb)/0.45)] bg-[rgb(var(--teal-rgb)/0.14)] text-[rgb(var(--teal-rgb))]"
          : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.72)] hover:text-text",
      )}
    >
      {icon}
      {typeof count === "number" ? <span>{count}</span> : null}
    </button>
  );
}

export function PostCard({
  post,
  onReact,
  onConnect,
  onOpenComments,
}: {
  post: Post;
  onReact: (postId: string, reactionType: "like" | "star") => void;
  onConnect: (post: Post) => void;
  onOpenComments: (post: Post) => void;
}) {
  const mediaUrl = post.photos.cover || post.photos.front || post.photos.back;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideo(mediaUrl)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            el.play().catch(() => null);
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0.4, 0.65, 0.9] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [mediaUrl]);

  const duoImages = useMemo(
    () => [post.photos.front, post.photos.back].filter(Boolean) as string[],
    [post.photos.front, post.photos.back],
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="snap-start"
    >
      <div className="overflow-hidden rounded-[22px] bg-[rgb(var(--surface-1-rgb)/0.92)] shadow-card">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src={post.user?.avatar_url || "https://placehold.co/100"}
              alt={post.user?.name ?? "avatar"}
              width={80}
              height={80}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
            <div className="min-w-0">
              {post.user?.id ? (
                <Link href={`/profile/${post.user.id}`} className="truncate text-sm font-semibold text-text hover:text-cyan">
                  {post.user.name}
                </Link>
              ) : (
                <p className="truncate text-sm font-semibold text-text">{post.user?.name ?? "Пользователь"}</p>
              )}
              <p className="text-xs text-text3">{new Date(post.created_at).toLocaleString("ru-RU")}</p>
            </div>
          </div>

          {post.type === "daily_duo" ? <Pill tone="teal">DUO</Pill> : <Pill>MEDIA</Pill>}
        </div>

        <div className="px-3 pb-3 pt-2">
          {post.type === "daily_duo" ? (
            <div className="grid grid-cols-2 gap-2">
              {duoImages.map((src, idx) => (
                <Image
                  key={`${src}-${idx}`}
                  src={src}
                  alt={`duo-${idx + 1}`}
                  width={800}
                  height={1000}
                  className="h-[44vh] w-full rounded-2xl object-cover"
                  unoptimized
                />
              ))}
            </div>
          ) : isVideo(mediaUrl) ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={mediaUrl}
                muted={muted}
                playsInline
                loop
                controls={false}
                className="h-[50vh] w-full rounded-2xl object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--sky-rgb)/0.24)] text-text">
                  <Play className="ml-0.5 h-5 w-5" />
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="absolute right-2 top-2 rounded-full bg-[rgb(var(--bg-rgb)/0.5)] p-2 text-text2"
                aria-label="Toggle sound"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <Image
              src={mediaUrl || "https://placehold.co/1200x1600"}
              alt="single"
              width={1200}
              height={1600}
              className="h-[50vh] w-full rounded-2xl object-cover"
              unoptimized
            />
          )}

          {post.caption ? renderCaption(post.caption) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionIcon
              label="Лайк"
              icon={<Heart className="h-4 w-4" />}
              count={post.reactions.like}
              active={post.viewer.liked}
              onClick={() => onReact(post.id, "like")}
            />
            <ActionIcon
              label="Комментарии"
              icon={<MessageCircle className="h-4 w-4" />}
              count={post.comments_count}
              onClick={() => onOpenComments(post)}
            />
            <ActionIcon
              label="Познакомиться"
              icon={<Handshake className="h-4 w-4" />}
              count={post.reactions.connect}
              active={post.viewer.connected}
              onClick={() => onConnect(post)}
            />
            <ActionIcon
              label="В избранное"
              icon={<Star className="h-4 w-4" />}
              count={post.reactions.star}
              active={post.viewer.starred}
              onClick={() => onReact(post.id, "star")}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
