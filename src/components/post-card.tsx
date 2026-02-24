"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Handshake, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <p className="mt-2 text-[14px] leading-5 text-text/95">
      {parts.map((part, idx) =>
        part.startsWith("@") ? (
          <span key={`${part}-${idx}`} className="font-medium text-[#8eb8ff]">
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="snap-start"
    >
      <div className="overflow-hidden rounded-[26px] border border-white/15 bg-surface/90 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-3">
            <Image
              src={post.user?.avatar_url || "https://placehold.co/100"}
              alt={post.user?.name ?? "avatar"}
              width={96}
              height={96}
              className="h-10 w-10 rounded-full border border-white/25 object-cover"
              unoptimized
            />
            <div>
              {post.user?.id ? (
                <Link href={`/profile/${post.user.id}`} className="text-sm font-semibold text-text hover:text-action">
                  {post.user.name}
                </Link>
              ) : (
                <p className="text-sm font-semibold">{post.user?.name ?? "Пользователь"}</p>
              )}
              <p className="text-xs text-muted">{new Date(post.created_at).toLocaleString("ru-RU")}</p>
            </div>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted">
            {post.type === "daily_duo" ? "Daily Duo" : "Media"}
          </span>
        </div>

        <div className="px-3 pb-3">
          {post.type === "daily_duo" ? (
            <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
              <Image
                src={post.photos.front || "https://placehold.co/800x1200"}
                alt="front"
                width={800}
                height={1200}
                className="h-[54vh] w-full object-cover"
                unoptimized
              />
              <Image
                src={post.photos.back || "https://placehold.co/800x1200"}
                alt="back"
                width={800}
                height={1200}
                className="h-[54vh] w-full object-cover"
                unoptimized
              />
            </div>
          ) : isVideo(mediaUrl) ? (
            <video
              src={mediaUrl}
              controls
              playsInline
              className="h-[58vh] w-full rounded-2xl object-cover"
            />
          ) : (
            <Image
              src={mediaUrl || "https://placehold.co/1200x1600"}
              alt="single"
              width={1200}
              height={1600}
              className="h-[58vh] w-full rounded-2xl object-cover"
              unoptimized
            />
          )}

          {post.caption ? renderCaption(post.caption) : null}

          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReact(post.id, "like")}
              disabled={post.viewer.liked}
              className={post.viewer.liked ? "border-[#52cc83]/50 bg-[#52cc83]/15 text-[#52cc83]" : ""}
            >
              <Heart className="mr-1 h-4 w-4" /> {post.reactions.like}
            </Button>

            <Button variant="secondary" size="sm" onClick={() => onOpenComments(post)}>
              <MessageCircle className="mr-1 h-4 w-4" /> {post.comments_count}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onConnect(post)}
              className={post.viewer.connected ? "border-[#8eb8ff]/50 bg-[#8eb8ff]/15 text-[#8eb8ff]" : ""}
            >
              <Handshake className="mr-1 h-4 w-4" /> {post.reactions.connect}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReact(post.id, "star")}
              disabled={post.viewer.starred}
              className={post.viewer.starred ? "border-[#ffcf70]/60 bg-[#ffcf70]/20 text-[#ffcf70]" : ""}
            >
              <Star className="mr-1 h-4 w-4" /> {post.reactions.star}
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
