"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, HeartHandshake, Settings, Shield, Smartphone, Sparkles, Trophy, UserCircle, type LucideIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type PsychProfile = {
  style?: string;
  energy?: string;
};

const tabs = ["Посты", "Репосты", "DUO"] as const;

type TabKey = (typeof tabs)[number];

type QuickSetting = {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
};

const quickSettings: QuickSetting[] = [
  { label: "Аккаунт", href: "/settings/account", icon: UserCircle, color: "rgb(var(--sky-rgb))" },
  { label: "Профиль", href: "/settings/profile", icon: Sparkles, color: "rgb(var(--violet-rgb))" },
  { label: "Приватность", href: "/settings/privacy", icon: Shield, color: "rgb(var(--teal-rgb))" },
  { label: "Сессии", href: "/settings/devices", icon: Smartphone, color: "rgb(var(--sky-rgb))" },
  { label: "Уведомления", href: "/settings/notifications", icon: Bell, color: "rgb(var(--gold-rgb))" },
  { label: "Знакомства", href: "/settings/dating", icon: HeartHandshake, color: "rgb(var(--teal-rgb))" },
  { label: "Психотест", href: "/settings/psychotest", icon: Sparkles, color: "rgb(var(--violet-rgb))" },
  { label: "Достижения", href: "/settings/achievements", icon: Trophy, color: "rgb(var(--gold-rgb))" },
];

function humanGoal(profile: any) {
  const prefs = profile?.preferences ?? {};
  return prefs.goal || prefs.intent || prefs.purpose || prefs.dating_goal || "";
}

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
    document.documentElement.classList.toggle("light", t === "light");
  }, []);

  const profile = data?.profile;
  const stats = data?.stats ?? { posts: 0, events: 0, connects: 0 };
  const psychProfile = useMemo(() => (profile?.personality_profile ?? null) as PsychProfile | null, [profile]);
  const lastPsychAt = profile?.personality_updated_at ? new Date(profile.personality_updated_at) : null;
  const needsPsychRefresh = !lastPsychAt || Date.now() - lastPsychAt.getTime() > 1000 * 60 * 60 * 24 * 30 * 6;
  const goal = humanGoal(profile);

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)] shadow-card">
          <CardContent className="relative p-6">
            <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.26),transparent_72%)] blur-3xl" />
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.26),transparent_70%)] blur-2xl" />
                  <div className="rounded-full p-[4px]" style={{ background: "var(--grad-primary)" }}>
                    <div className="rounded-full bg-[rgb(var(--surface-1-rgb))] p-[2px]">
                      <Image
                        src={profile?.avatar_url || "https://placehold.co/320x320"}
                        alt={profile?.name || "avatar"}
                        width={240}
                        height={240}
                        className="h-36 w-36 rounded-full object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-semibold text-text">{profile?.name || "Профиль"}</h1>
                  {profile?.username ? <p className="text-sm text-text2">@{profile.username}</p> : null}
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    {profile?.city ? <span className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] px-2 py-0.5 text-xs text-text2">{profile.city}</span> : null}
                    {profile?.work ? <span className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] px-2 py-0.5 text-xs text-text2">{profile.work}</span> : null}
                    {profile?.telegram_verified ? (
                      <span className="rounded-full border border-[rgb(var(--success-rgb)/0.4)] bg-[rgb(var(--success-rgb)/0.18)] px-2 py-0.5 text-xs text-[rgb(var(--text-rgb))]">Верифицирован</span>
                    ) : (
                      <span className="rounded-full border border-[rgb(var(--warning-rgb)/0.4)] bg-[rgb(var(--warning-rgb)/0.18)] px-2 py-0.5 text-xs text-[rgb(var(--text-rgb))]">Не верифицирован</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => router.push("/profile/me/edit")} className="w-full">Редактировать профиль</Button>
                  <Button variant="secondary" onClick={() => router.push("/settings")} className="w-full">
                    <Settings className="mr-1 h-4 w-4" /> Настройки
                  </Button>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-3">
                  <p className="text-xs text-text2">Цель знакомства</p>
                  <p className="text-sm text-text mt-1">{goal || "Добавь цель знакомства — это улучшит рекомендации"}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-2 text-center">
                <p className="text-sm font-semibold text-text">{stats.posts}</p>
                <p className="text-[11px] text-text3">посты</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-2 text-center">
                <p className="text-sm font-semibold text-text">{stats.events}</p>
                <p className="text-[11px] text-text3">события</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] p-2 text-center">
                <p className="text-sm font-semibold text-text">{stats.connects}</p>
                <p className="text-[11px] text-text3">коннекты</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--violet-rgb)/0.2)] text-[rgb(var(--violet-rgb))]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">Психопрофиль</p>
                <p className="text-xs text-text2">{psychProfile?.style || "Не пройден"}</p>
                {needsPsychRefresh ? <p className="mt-1 text-xs text-[rgb(var(--violet-rgb))]">Пора обновить тест для более точных рекомендаций.</p> : null}
              </div>
              <Link href="/settings/psychotest">
                <Button variant="secondary" size="sm">{needsPsychRefresh ? "Обновить" : "Открыть"}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">Быстрые настройки</p>
                <p className="text-xs text-text2">Каждый раздел — отдельная страница</p>
              </div>
              <Link href="/settings" className="text-xs text-[rgb(var(--sky-rgb))]">Все настройки</Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickSettings.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-3 py-2 text-sm text-text transition hover:bg-[rgb(var(--surface-2-rgb))]"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{
                      background: item.color.replace("rgb(", "rgba(").replace(")", ", 0.18)"),
                      border: `1px solid ${item.color.replace("rgb(", "rgba(").replace(")", ", 0.35)")}`,
                    }}
                  >
                    <span style={{ color: item.color }}><item.icon className="h-5 w-5" /></span>
                  </span>
                  <span className="text-sm font-medium text-text">{item.label}</span>
                </Link>
              ))}
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
