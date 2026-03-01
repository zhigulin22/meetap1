"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CircleHelp,
  LogOut,
  Monitor,
  Shield,
  Sparkles,
  Trophy,
  User,
  Users,
  Brain,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileSettingsRow } from "@/components/profile-settings-row";
import { api } from "@/lib/api-client";

const PSYCH_REMINDER_KEY = "meetap_psych_reminder_until";
const PSYCH_REMINDER_DAYS = 7;

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "Не указан";
  const clean = phone.replace(/\s/g, "");
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 3)} *** ${clean.slice(-2)}`;
}

export default function MyProfileHubPage() {
  const router = useRouter();
  const [showPsychCard, setShowPsychCard] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-me-hub-v2"],
    queryFn: () => api<{ profile: any; activity: { posts: number; eventJoins: number; connections: number; reactions: number } }>("/api/profile/me"),
  });

  const profile = meQuery.data?.profile;

  const psychCompleted = Boolean(profile?.personality_profile);

  useEffect(() => {
    if (psychCompleted) {
      setShowPsychCard(false);
      return;
    }

    const raw = localStorage.getItem(PSYCH_REMINDER_KEY);
    if (!raw) {
      setShowPsychCard(true);
      return;
    }

    const until = Number(raw);
    setShowPsychCard(!Number.isFinite(until) || Date.now() > until);
  }, [psychCompleted]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    let c = 0;
    if (profile.avatar_url) c += 20;
    if (profile.bio) c += 15;
    if (profile.country && profile.city) c += 15;
    if (profile.university && profile.work) c += 20;
    if ((profile.interests ?? []).length >= 3) c += 15;
    if ((profile.facts ?? []).length >= 2) c += 15;
    return c;
  }, [profile]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/register");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось выйти");
    }
  }

  function remindLater() {
    const until = Date.now() + PSYCH_REMINDER_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(PSYCH_REMINDER_KEY, String(until));
    setShowPsychCard(false);
  }

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text">Мой профиль</h1>
        <span className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-muted">Settings Hub</span>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="h-28 bg-[linear-gradient(120deg,rgba(7,15,38,0.98),rgba(82,204,131,0.25),rgba(96,170,255,0.35))]" />
        <CardContent className="-mt-12 p-4">
          <div className="flex items-end gap-3">
            <Image
              src={profile?.avatar_url || "https://placehold.co/320x320"}
              alt="avatar"
              width={160}
              height={160}
              unoptimized
              className="h-24 w-24 rounded-3xl border-2 border-white/70 object-cover"
            />
            <div className="pb-1">
              <p className="text-lg font-semibold text-text">{profile?.name || "Пользователь"}</p>
              <p className="text-xs text-muted">{maskPhone(profile?.phone)}</p>
              <p className="text-xs text-muted">{profile?.city || "Город не указан"}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-surface2/75 p-3">
            <p className="text-xs text-muted">Заполненность профиля</p>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <motion.div initial={false} animate={{ width: `${completion}%` }} className="h-2 rounded-full bg-[linear-gradient(90deg,#52CC83,#7ec4ff)]" />
            </div>
            <p className="mt-1 text-xs text-text">{completion}%</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block">
              <Button variant="secondary" className="w-full">Как видят другие</Button>
            </Link>
            <Link href="/profile/me/edit" className="block">
              <Button variant="secondary" className="w-full">Редактировать</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {!psychCompleted && showPsychCard ? (
        <Card className="mb-3 border-action/30 bg-action/10">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-text">Психотест не пройден</p>
            <p className="text-xs text-muted">
              Это улучшит рекомендации знакомств, подбор людей и персональные подсказки для первого шага. Прохождение 4-6 минут.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/profile/me/psych-test" className="block">
                <Button className="w-full">Пройти сейчас</Button>
              </Link>
              <Button variant="secondary" className="w-full" onClick={remindLater}>
                Напомнить позже
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileSettingsRow href="/profile/me/account" icon={<User className="h-4 w-4" />} title="Аккаунт" subtitle="Имя, email, телефон, удаление" />
          <ProfileSettingsRow href="/profile/me/edit" icon={<Sparkles className="h-4 w-4" />} title="Профиль" subtitle="Фото, bio, факты, интересы, город" />
          <ProfileSettingsRow href="/profile/me/privacy" icon={<Shield className="h-4 w-4" />} title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" />
          <ProfileSettingsRow href="/profile/me/sessions" icon={<Monitor className="h-4 w-4" />} title="Устройства и активные сессии" subtitle="Контроль входов" />
          <ProfileSettingsRow href="/profile/me/notifications" icon={<Bell className="h-4 w-4" />} title="Уведомления" subtitle="Коннекты, ответы, ивенты" />
          <ProfileSettingsRow href="/profile/me/preferences" icon={<Users className="h-4 w-4" />} title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как match-имся" />
          <ProfileSettingsRow
            href="/profile/me/psych-test"
            icon={<Brain className="h-4 w-4" />}
            title="Психотест"
            subtitle={psychCompleted ? "Пройден, можно обновить" : "Не пройден — влияет на качество рекомендаций"}
            badge={
              psychCompleted ? (
                <span className="rounded-full border border-[#52CC83]/40 bg-[#52CC83]/10 px-2 py-0.5 text-[10px] text-action">OK</span>
              ) : (
                <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">Важно</span>
              )
            }
          />
          <ProfileSettingsRow href="/profile/me/achievements" icon={<Trophy className="h-4 w-4" />} title="Достижения" subtitle="Скоро" />
          <ProfileSettingsRow href="/profile/me/help" icon={<CircleHelp className="h-4 w-4" />} title="Помощь / О приложении" subtitle="Как использовать профиль" />

          <button
            type="button"
            onClick={logout}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-danger/50 bg-danger/10 text-sm font-medium text-danger transition active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
