"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  HeartHandshake,
  Lock,
  Smartphone,
  User,
  Brain,
  Trophy,
  UserCircle,
  ShieldCheck,
  Sparkles,
  Settings,
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

function humanAge(profile: any) {
  const b = profile?.birthdate || profile?.birthday;
  if (!b) return null;
  try {
    const birth = new Date(b);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
    return Number.isFinite(age) ? age : null;
  } catch {
    return null;
  }
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
  const age = humanAge(profile);
  const interests = Array.isArray(profile?.interests) ? profile.interests.filter(Boolean).slice(0, 8) : [];
  const bio = profile?.bio || "";

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="overflow-hidden rounded-[36px] border border-[color:var(--border-strong)] bg-[linear-gradient(165deg,rgba(24,32,68,0.98),rgba(12,18,40,0.98))] shadow-card">
          <div className="relative h-[52vh] min-h-[380px]">
            <Image
              src={profile?.avatar_url || "https://placehold.co/1200x1600?text=MEETAP"}
              alt={profile?.name || "avatar"}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,24,0.08),rgba(8,12,24,0.88))]" />

            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-[rgb(var(--violet-rgb)/0.55)] bg-[rgb(var(--surface-1-rgb)/0.9)] px-3 py-1 text-xs text-text">
              <Sparkles className="h-4 w-4" /> {stats.connects + 40}% профиль
            </div>

            <div className="absolute bottom-5 left-5 right-5 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold text-white">
                    {profile?.name || "Профиль"}
                    {age ? <span className="ml-2 text-lg text-text2">{age}</span> : null}
                  </h1>
                  {profile?.username ? <p className="text-sm text-text2">@{profile.username}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => router.push("/profile/me/edit")} className="h-12 px-6">Редактировать</Button>
                  <Button variant="secondary" onClick={() => router.push("/settings")} className="h-12 px-6">
                    <Settings className="mr-1 h-4 w-4" /> Настройки
                  </Button>
                  {isAdmin ? (
                    <Button variant="secondary" onClick={() => router.push("/admin")} className="h-12 px-6">
                      Открыть Admin
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-text2">
                {profile?.city ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-2 py-0.5">
                    {profile.city}
                  </span>
                ) : null}
                {university ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] px-2 py-0.5 text-text">
                    🎓 {university} · подтверждено
                  </span>
                ) : null}
                {profile?.telegram_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--success-rgb)/0.5)] bg-[rgb(var(--success-rgb)/0.18)] px-2 py-0.5 text-text">
                    <BadgeCheck className="h-3.5 w-3.5" /> Верифицирован
                  </span>
                ) : null}
              </div>

              {interests.length ? (
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest: string) => (
                    <span key={interest} className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] px-2.5 py-1 text-xs text-text">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <CardContent className="space-y-4 p-6">
            {(goal || psychSummary) ? (
              <div className="grid gap-2 md:grid-cols-2">
                {goal ? (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] p-3">
                    <p className="text-xs text-text3">Цель знакомства</p>
                    <p className="mt-1 text-sm text-text">{goal}</p>
                  </div>
                ) : null}
                {psychSummary ? (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] p-3">
                    <p className="text-xs text-text3">Краткий психотип</p>
                    <p className="mt-1 text-sm text-text">{psychSummary}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {bio ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.92)] p-4">
                <p className="text-sm font-semibold text-text">О себе</p>
                <p className="mt-1 line-clamp-3 text-sm text-text2">{bio}</p>
              </div>
            ) : null}

            {quote ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3 text-sm text-text">
                {quote}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
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

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">Быстрые настройки</p>
                <p className="text-xs text-text2">Каждый раздел — отдельная страница</p>
              </div>
              <Link href="/settings" className="text-xs text-[rgb(var(--sky-rgb))]">Все настройки</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickSettings.map((item) => {
                const tone = toneStyles[item.tone];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.95)] px-4 py-3 text-sm text-text transition hover:bg-[rgb(var(--surface-2-rgb))]"
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
                className={`h-12 rounded-2xl text-sm font-semibold transition ${
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

        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-semibold text-text">Пока нет контента</p>
            <p className="text-xs text-text2">Создай пост или DUO, чтобы наполнить профиль</p>
            <Button className="mt-3 h-12" onClick={() => router.push("/feed")}>Перейти в ленту</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
