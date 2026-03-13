"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type PsychProfile = {
  style?: string;
};

const tabs = ["Посты", "Репосты", "DUO"] as const;

type TabKey = (typeof tabs)[number];

export default function MyProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState<TabKey>("Посты");

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ profile: any; stats: { posts: number; events: number; connects: number } }>("/api/profile/me"),
  });

  useEffect(() => {
    const t = (localStorage.getItem("theme") as "dark" | "light" | null) ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const profile = data?.profile;
  const stats = data?.stats ?? { posts: 0, events: 0, connects: 0 };
  const psychProfile = useMemo(() => (profile?.personality_profile ?? null) as PsychProfile | null, [profile]);

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)] shadow-card">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.16),transparent_70%)] blur-2xl" />
                <div className="rounded-full p-[4px]" style={{ background: "linear-gradient(135deg, rgb(var(--sky-rgb)), rgb(var(--violet-rgb)))" }}>
                  <div className="rounded-full bg-[rgb(var(--surface-1-rgb))] p-[2px]">
                    <Image
                      src={profile?.avatar_url || "https://placehold.co/320x320"}
                      alt={profile?.name || "avatar"}
                      width={220}
                      height={220}
                      className="h-36 w-36 rounded-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-text">{profile?.name || "Пользователь"}</h1>
                <p className="text-sm text-text2">{profile?.work || profile?.university || "Добавь род занятий"}</p>
                {profile?.username ? <p className="text-xs text-text3">@{profile.username}</p> : null}
              </div>

              <div className="grid w-full grid-cols-3 gap-2">
                {[
                  { label: "Посты", value: stats.posts },
                  { label: "События", value: stats.events },
                  { label: "Коннекты", value: stats.connects },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3 text-center">
                    <p className="text-lg font-semibold text-text">{s.value}</p>
                    <p className="text-xs text-text2">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link href="/settings/profile" className="inline-flex"><Button variant="secondary">Редактировать профиль</Button></Link>
                <Link href="/settings" className="inline-flex"><Button>Настройки</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] p-2">
                <Sparkles className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">Психопрофиль</p>
                <p className="text-xs text-text2">{psychProfile?.style || "Не пройден"}</p>
                <Link href="/settings/psychotest" className="mt-2 inline-flex">
                  <Button variant="secondary" size="sm">Пройти психотест</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-2">
          <div className="grid grid-cols-3 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-xl text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))] text-white shadow-soft"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] text-text2"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-text">Пока нет контента</p>
            <p className="mt-1 text-xs text-text2">Создай пост или DUO, чтобы заполнить профиль</p>
            <Button className="mt-3" onClick={() => router.push("/feed")}>Перейти в ленту</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
