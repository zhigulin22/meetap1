"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Handshake, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Post = {
  id: string;
  type: "daily_duo" | "reel";
  caption: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_url: string | null } | null;
  photos: { front?: string; back?: string; cover?: string };
  reactions: { like: number; connect: number; star: number };
};

export function PostCard({
  post,
  onReact,
  onConnect,
}: {
  post: Post;
  onReact: (postId: string, reactionType: "like" | "star") => void;
  onConnect: (post: Post) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {post.user?.id ? (
              <Link href={`/profile/${post.user.id}`} className="hover:text-action">
                {post.user.name}
              </Link>
            ) : (
              <span>{post.user?.name ?? "Аноним"}</span>
            )}
            <span className="text-xs font-normal text-muted">
              {new Date(post.created_at).toLocaleString("ru-RU")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {post.type === "reel" ? (
            <video
              src={
                post.photos.cover ||
                "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
              }
              controls
              playsInline
              className="h-[420px] w-full rounded-xl object-cover"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
              <Image
                src={post.photos.front || "https://placehold.co/600x900"}
                alt="front"
                width={600}
                height={900}
                className="h-52 w-full object-cover"
                unoptimized
              />
              <Image
                src={post.photos.back || "https://placehold.co/600x900"}
                alt="back"
                width={600}
                height={900}
                className="h-52 w-full object-cover"
                unoptimized
              />
            </div>
          )}
          {post.caption ? <p className="text-sm">{post.caption}</p> : null}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => onReact(post.id, "like")}>
              <Heart className="mr-1 h-4 w-4" /> {post.reactions.like}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onConnect(post)}>
              <Handshake className="mr-1 h-4 w-4" /> {post.reactions.connect}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onReact(post.id, "star")}>
              <Star className="mr-1 h-4 w-4" /> {post.reactions.star}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
