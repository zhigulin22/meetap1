"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Brain,
  CheckCircle2,
  CircleHelp,
  LogOut,
  Monitor,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileSettingsRow } from "@/components/profile-settings-row";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";
import { api } from "@/lib/api-client";
import { getThemeGradient } from "@/lib/profile-style";

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
  const [activatingAdmin, setActivatingAdmin] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-me-hub-v4"],
    queryFn: () => api<{ profile: any; activity: { posts: number; eventJoins: number; connections: number; reactions: number } }>("/api/profile/me"),
  });

  const adminAccessQuery = useQuery({
    queryKey: ["profile-admin-access"],
    queryFn: () => api<any>("/api/admin/access"),
    retry: false,
    staleTime: 10_000,
  });

  const canOpenAdmin = adminAccessQuery.data?.can_admin === true;

  const profile = meQuery.data?.profile;
  const activity = meQuery.data?.activity;
  const psychCompleted = Boolean(profile?.personality_profile);
  const themeGradient = getThemeGradient(profile?.preferences?.profileColor);

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

  const qualityItems = useMemo(() => {
    const hasProfessionalContext = Boolean(
      profile?.university || profile?.work || profile?.preferences?.activity || profile?.preferences?.specialty,
    );

    return [
      { key: "photo", label: "Фото", done: Boolean(profile?.avatar_url) },
      { key: "facts", label: "Факты", done: (profile?.facts ?? []).length >= 2 },
      { key: "interests", label: "Интересы", done: (profile?.interests ?? []).length >= 3 },
      { key: "bio", label: "Bio", done: Boolean(profile?.bio) },
      { key: "context", label: "Профконтекст", done: hasProfessionalContext },
      { key: "psych", label: "Психотест", done: psychCompleted },
    ];
  }, [profile, psychCompleted]);

  const completion = useMemo(() => {
    if (!qualityItems.length) return 0;
    const done = qualityItems.filter((x) => x.done).length;
    return Math.round((done / qualityItems.length) * 100);
  }, [qualityItems]);

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

  async function activateAdminAccess() {
    try {
      setActivatingAdmin(true);
      await api("/api/auth/bootstrap-admin", { method: "POST" });
      await Promise.all([adminAccessQuery.refetch(), meQuery.refetch()]);
      toast.success("Админ-доступ активирован");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось активировать админ-доступ");
    } finally {
      setActivatingAdmin(false);
    }
  }

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-[1.55rem] font-semibold tracking-[-0.02em] text-[#eef4ff]">Мой профиль</h1>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-[#b9c8df]">Apple-style hub</span>
      </div>

      <Card className="mb-3 overflow-hidden border-white/20 bg-surface/90 backdrop-blur-2xl">
        <div className="relative h-[19rem] overflow-hidden border-b border-white/15" style={{ background: themeGradient }}>
          <div className="absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(76,141,255,0.38),transparent_68%)]" />
          <div className="absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(82,204,131,0.32),transparent_68%)]" />
          <div className="absolute inset-y-0 left-0 w-24 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.11)_0px,rgba(255,255,255,0.11)_1px,transparent_1px,transparent_9px)] opacity-45" />
          <div className="absolute inset-y-0 right-0 w-24 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.11)_0px,rgba(255,255,255,0.11)_1px,transparent_1px,transparent_9px)] opacity-45" />

          <div className="absolute inset-x-0 bottom-4 z-10 text-center">
            <Image
              src={profile?.avatar_url || "https://placehold.co/560x560"}
              alt="avatar"
              width={220}
              height={220}
              unoptimized
              className="mx-auto h-40 w-40 rounded-[38px] border-2 border-white/75 object-cover shadow-[0_24px_54px_rgba(0,0,0,0.45)]"
            />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3 py-1.5 backdrop-blur-xl">
              <p className="text-[1.05rem] font-semibold leading-none text-[#f1f5ff]">{profile?.name || "Пользователь"}</p>
              <ProfileEmojiBadge value={profile?.preferences?.profileEmoji} />
              {profile?.telegram_verified ? <span title="Телефон подтвержден"><CheckCircle2 className="h-4 w-4 text-[#52CC83]" /></span> : null}
            </div>
            <p className="mt-1 text-xs text-[#d9e4f7]">
              {maskPhone(profile?.phone)} · {profile?.city || "Город не указан"}
            </p>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/15 bg-white/7 px-3 py-2">
              <p className="text-[11px] text-[#aebcd4]">Публикации</p>
              <p className="text-sm font-semibold text-[#eef4ff]">{activity?.posts ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/7 px-3 py-2">
              <p className="text-[11px] text-[#aebcd4]">Посещено ивентов</p>
              <p className="text-sm font-semibold text-[#eef4ff]">{activity?.eventJoins ?? 0}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/8 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#aebbd2]">Profile Quality</p>
              <p className="text-xs font-semibold text-[#eaf2ff]">{completion}%</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <motion.div
                initial={false}
                animate={{ width: `${completion}%` }}
                className="h-2 rounded-full bg-[linear-gradient(90deg,#4C8DFF,#52CC83)]"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {qualityItems.map((item) => (
                <div
                  key={item.key}
                  className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                    item.done
                      ? "border-[#52CC83]/40 bg-[#52CC83]/12 text-[#ddffe9]"
                      : "border-white/15 bg-white/5 text-[#aebcd3]"
                  }`}
                >
                  {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current" />} {item.label}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#93a3bf]">Чеклист помогает получать более точные рекомендации без давления.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block">
              <Button variant="secondary" className="w-full">
                Как видят другие
              </Button>
            </Link>
            <Link href="/profile/me/edit" className="block">
              <Button variant="secondary" className="w-full">
                Редактировать
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {!psychCompleted && showPsychCard ? (
        <Card className="mb-3 border-[#4C8DFF]/35 bg-[linear-gradient(120deg,rgba(76,141,255,0.16),rgba(82,204,131,0.14))]">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-[#eef4ff]">Психотест ещё не пройден</p>
            <p className="text-xs text-[#c4d3ea]">
              После теста алгоритм точнее подбирает людей, и дает полезные подсказки для первого знакомства.
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

      {canOpenAdmin ? (
        <Card className="mb-3 border-[#4C8DFF]/35 bg-[#4C8DFF]/11">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-[#ecf3ff]">Админ-панель доступна</p>
              <p className="text-xs text-[#b8c8e1]">Модерация, метрики, роли и операционный контроль</p>
            </div>
            <Link href="/admin" className="shrink-0">
              <Button>
                <ShieldCheck className="mr-1 h-4 w-4" /> Открыть Admin
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-3 border-[#4C8DFF]/28 bg-[#4C8DFF]/8">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium text-[#ecf3ff]">Нет кнопки Admin?</p>
              <p className="text-xs text-[#b8c8e1]">Нажми один раз, если этот аккаунт должен быть админом.</p>
            </div>
            <Button onClick={activateAdminAccess} disabled={activatingAdmin}>
              <ShieldCheck className="mr-1 h-4 w-4" /> {activatingAdmin ? "Активируем..." : "Активировать админ-доступ"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/15 bg-surface/86 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-[#edf3ff]">Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileSettingsRow href="/profile/me/account" icon={<User className="h-4 w-4" />} iconToneClass="bg-[#4C8DFF]/20 text-[#d8e8ff]" title="Аккаунт" subtitle="Имя, email, телефон, удаление" />
          <ProfileSettingsRow href="/profile/me/edit" icon={<Sparkles className="h-4 w-4" />} iconToneClass="bg-[#57b0ff]/20 text-[#d8eeff]" title="Профиль" subtitle="Фото, bio, факты, интересы, город" />
          <ProfileSettingsRow href="/profile/me/privacy" icon={<Shield className="h-4 w-4" />} iconToneClass="bg-[#52CC83]/20 text-[#ddffe9]" title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" />
          <ProfileSettingsRow href="/profile/me/sessions" icon={<Monitor className="h-4 w-4" />} iconToneClass="bg-[#839cff]/20 text-[#e5ebff]" title="Устройства и активные сессии" subtitle="Управление входами, завершение сессий" />
          <ProfileSettingsRow href="/profile/me/notifications" icon={<Bell className="h-4 w-4" />} iconToneClass="bg-[#77c4ff]/20 text-[#def3ff]" title="Уведомления" subtitle="Коннекты, ответы, ивенты" />
          <ProfileSettingsRow href="/profile/me/preferences" icon={<Users className="h-4 w-4" />} iconToneClass="bg-[#8fb4ff]/20 text-[#e2edff]" title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как match-имся" />
          <ProfileSettingsRow
            href="/profile/me/psych-test"
            icon={<Brain className="h-4 w-4" />}
            iconToneClass="bg-[#FFB020]/20 text-[#ffedc7]"
            title="Психотест"
            subtitle={psychCompleted ? "Пройден, можно обновить" : "Не пройден — влияет на качество рекомендаций"}
            badge={
              psychCompleted ? (
                <span className="rounded-full border border-[#52CC83]/40 bg-[#52CC83]/12 px-2 py-0.5 text-[10px] text-[#ddffe9]">OK</span>
              ) : (
                <span className="rounded-full border border-[#FFB020]/50 bg-[#FFB020]/12 px-2 py-0.5 text-[10px] text-[#ffe5b4]">Важно</span>
              )
            }
          />
          <ProfileSettingsRow href="/profile/me/achievements" icon={<Trophy className="h-4 w-4" />} iconToneClass="bg-[#FFB020]/20 text-[#ffe6b6]" title="Достижения" subtitle="Яркие полученные и цели на будущее" />
          <ProfileSettingsRow href="/profile/me/help" icon={<CircleHelp className="h-4 w-4" />} iconToneClass="bg-[#5ad1af]/20 text-[#d9fff3]" title="Помощь / О приложении" subtitle="Как использовать профиль" />

          <button
            type="button"
            onClick={logout}
            className="mt-1 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-danger/50 bg-danger/12 text-sm font-semibold text-danger transition active:scale-[0.988]"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
