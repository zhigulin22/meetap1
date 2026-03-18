"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  HeartHandshake,
  Settings,
  Lock,
  Smartphone,
  User,
  Brain,
  Trophy,
  UserCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type PsychProfile = {
  style?: string;
  energy?: string;
  summary?: string;
};

const tabs = ["Посты", "Репосты", "DUO"] as const;

type TabKey = (typeof tabs)[number];

type QuickSetting = {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: "sky" | "violet" | "amber" | "teal";
};

const quickSettings: QuickSetting[] = [
  { label: "Аккаунт", href: "/settings/account", icon: UserCircle, tone: "sky" },
  { label: "Профиль", href: "/settings/profile", icon: User, tone: "violet" },
  { label: "Приватность", href: "/settings/privacy", icon: Lock, tone: "violet" },
  { label: "Сессии", href: "/settings/devices", icon: Smartphone, tone: "sky" },
  { label: "Уведомления", href: "/settings/notifications", icon: Bell, tone: "sky" },
  { label: "Знакомства", href: "/settings/dating", icon: HeartHandshake, tone: "violet" },
  { label: "Психотест", href: "/settings/psychotest", icon: Brain, tone: "violet" },
  { label: "Достижения", href: "/settings/achievements", icon: Trophy, tone: "amber" },
];

const toneStyles: Record<QuickSetting["tone"], { bg: string; border: string; icon: string }> = {
  sky: {
    bg: "bg-[rgb(var(--sky-rgb)/0.22)]",
    border: "border-[rgb(var(--sky-rgb)/0.55)]",
    icon: "text-[rgb(var(--sky-rgb))]",
  },
  violet: {
    bg: "bg-[rgb(var(--violet-rgb)/0.22)]",
    border: "border-[rgb(var(--violet-rgb)/0.55)]",
    icon: "text-[rgb(var(--violet-rgb))]",
  },
  amber: {
    bg: "bg-[rgb(var(--warning-rgb)/0.22)]",
    border: "border-[rgb(var(--warning-rgb)/0.55)]",
    icon: "text-[rgb(var(--warning-rgb))]",
  },
  teal: {
    bg: "bg-[rgb(var(--teal-rgb)/0.22)]",
    border: "border-[rgb(var(--teal-rgb)/0.55)]",
    icon: "text-[rgb(var(--teal-rgb))]",
  },
};

function humanGoal(profile: any) {
  const prefs = profile?.preferences ?? {};
  return prefs.goal || prefs.intent || prefs.purpose || prefs.dating_goal || "";
}

export default function MyProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("Посты");

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ profile: any; stats: { posts: number; events: number; connects: number } }>("/api/profile/me"),
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  const profile = data?.profile;
  const stats = data?.stats ?? { posts: 0, events: 0, connects: 0 };
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const psychProfile = useMemo(() => (profile?.personality_profile ?? null) as PsychProfile | null, [profile]);
  const lastPsychAt = profile?.personality_updated_at ? new Date(profile.personality_updated_at) : null;
  const needsPsychRefresh = !lastPsychAt || Date.now() - lastPsychAt.getTime() > 1000 * 60 * 60 * 24 * 30 * 6;
  const goal = humanGoal(profile);
  const quote = profile?.preferences?.quote ?? "";
  const psychSummary = psychProfile?.summary || psychProfile?.style || "";
  const university = profile?.student_verified ? profile?.student_university || profile?.university : null;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="relative overflow-hidden border-[color:var(--border-strong)] bg-[linear-gradient(140deg,rgba(12,16,32,0.98),rgba(8,10,22,0.98))] shadow-card">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.35),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-6 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.28),transparent_72%)] blur-3xl" />
          <CardContent className="relative p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.4),transparent_70%)] blur-2xl" />
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
                      {profile?.username ? <p className="mt-1 text-sm text-text2">@{profile.username}</p> : null}
                      {university ? <p className="mt-1 text-xs text-text3">{university}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {profile?.city ? (
                          <span className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] px-2 py-0.5 text-xs text-text2">
                            {profile.city}
                          </span>
                        ) : null}
                        {profile?.student_verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.18)] px-2 py-0.5 text-xs text-text">
                            <ShieldCheck className="h-3.5 w-3.5" /> ВУЗ подтвержден
                          </span>
                        ) : null}
                        {profile?.telegram_verified ? (
                          <span className="rounded-full border border-[rgb(var(--success-rgb)/0.4)] bg-[rgb(var(--success-rgb)/0.16)] px-2 py-0.5 text-xs text-text">
                            Верифицирован
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => router.push("/profile/me/edit")} className="h-9 px-4">Редактировать</Button>
                    <Button size="sm" variant="secondary" onClick={() => router.push("/settings")} className="h-9 px-4">
                      <Settings className="mr-1 h-4 w-4" /> Настройки
                    </Button>
                    {isAdmin ? (
                      <Button size="sm" variant="secondary" onClick={() => router.push("/admin")} className="h-9 px-4">
                        Открыть Admin
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                    <p className="text-xs text-text2">Цель знакомства</p>
                    <p className="mt-1 text-sm text-text">{goal || "Добавь цель знакомства — это улучшит рекомендации"}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3">
                    <p className="text-xs text-text2">Краткий психотип</p>
                    <p className="mt-1 text-sm text-text">{psychSummary || "Пройди психотест для точного профиля"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] p-2 text-center shadow-soft">
                <p className="text-base font-semibold text-text">{stats.events}</p>
                <p className="text-[11px] text-text3">события</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-3-rgb)/0.75)] p-2 text-center">
                <p className="text-base font-semibold text-text">{stats.connects}</p>
                <p className="text-[11px] text-text3">матчи</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-3-rgb)/0.75)] p-2 text-center">
                <p className="text-base font-semibold text-text">{stats.posts}</p>
                <p className="text-[11px] text-text3">посты</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--violet-rgb)/0.2)] text-[rgb(var(--violet-rgb))]">
                <Brain className="h-5 w-5" />
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
            <p className="text-sm font-semibold text-text">Цитата</p>
            <p className="mt-1 text-sm text-text2">{quote || "Добавь личную цитату в редактировании профиля"}</p>
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
              {quickSettings.map((item) => {
                const tone = toneStyles[item.tone];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] px-3 py-2 text-sm text-text transition hover:bg-[rgb(var(--surface-2-rgb))]"
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tone.bg} ${tone.border}`}>
                      <item.icon className={`h-5 w-5 ${tone.icon}`} />
                    </span>
                    <span className="text-sm font-medium text-text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] p-2 shadow-soft">
          <div className="grid grid-cols-3 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-xl text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-[image:var(--grad-primary)] text-white shadow-[0_10px_24px_rgba(122,84,255,0.35)]"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.7)] text-text2"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-semibold text-text">Пока нет контента</p>
            <p className="text-xs text-text2">Создай пост или DUO, чтобы наполнить профиль</p>
            <Button className="mt-3" onClick={() => router.push("/feed")}>Перейти в ленту</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
