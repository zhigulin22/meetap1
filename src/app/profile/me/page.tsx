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
  ShieldCheck,
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
    queryKey: ["profile-me-hub-v3"],
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

  const completion = useMemo(() => {
    if (!profile) return 0;
    let c = 0;
    if (profile.avatar_url) c += 20;
    if (profile.bio) c += 15;
    if (profile.country && profile.city) c += 15;
    const hasProfessionalContext = Boolean(profile.university || profile.work || profile.preferences?.activity || profile.preferences?.specialty);
    if (hasProfessionalContext) c += 20;
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
        <h1 className="font-display text-2xl font-semibold text-text">Мой профиль</h1>
        <span className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-muted">Settings Hub</span>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="relative h-48 overflow-hidden border-b border-border/60" style={{ background: themeGradient }}>
          <div className="absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(119,149,255,0.30),transparent_70%)]" />
          <div className="absolute -right-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,208,255,0.26),transparent_70%)]" />
          <div className="absolute left-0 top-0 h-full w-24 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_8px)] opacity-35" />
          <div className="absolute right-0 top-0 h-full w-24 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_8px)] opacity-35" />

          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <Image
              src={profile?.avatar_url || "https://placehold.co/320x320"}
              alt="avatar"
              width={160}
              height={160}
              unoptimized
              className="mx-auto h-32 w-32 rounded-[30px] border-2 border-white/70 object-cover shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            />
            <div className="mt-2 inline-flex items-center gap-2">
              <p className="text-sm font-semibold text-text">{profile?.name || "Пользователь"}</p>
              <ProfileEmojiBadge value={profile?.preferences?.profileEmoji} />
            </div>
            <p className="text-xs text-muted">{maskPhone(profile?.phone)} · {profile?.city || "Город не указан"}</p>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="rounded-xl border border-border bg-surface2/75 p-3">
            <p className="text-xs text-muted">Заполненность профиля</p>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <motion.div initial={false} animate={{ width: `${completion}%` }} className="h-2 rounded-full bg-[linear-gradient(90deg,#6f9fff,#8ad0ff)]" />
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
        <Card className="mb-3 border-[#6f9fff]/40 bg-[#6f9fff]/10">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-text">Психотест не пройден</p>
            <p className="text-xs text-muted">Улучшит рекомендации знакомств, подбор людей и персональные подсказки для первого шага. 4–6 минут.</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/profile/me/psych-test" className="block"><Button className="w-full">Пройти сейчас</Button></Link>
              <Button variant="secondary" className="w-full" onClick={remindLater}>Напомнить позже</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canOpenAdmin ? (
        <Card className="mb-3 border-[#7aa2ff]/40 bg-[#7aa2ff]/10">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-text">Админ-панель доступна</p>
              <p className="text-xs text-muted">Управление метриками, модерацией и ролями</p>
            </div>
            <Link href="/admin" className="shrink-0">
              <Button><ShieldCheck className="mr-1 h-4 w-4" /> Открыть Admin</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-3 border-[#7aa2ff]/30 bg-[#7aa2ff]/8">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium text-text">Нет кнопки Admin?</p>
              <p className="text-xs text-muted">Нажми один раз, если этот аккаунт должен быть админом.</p>
            </div>
            <Button onClick={activateAdminAccess} disabled={activatingAdmin}>
              <ShieldCheck className="mr-1 h-4 w-4" /> {activatingAdmin ? "Активируем..." : "Активировать админ-доступ"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileSettingsRow href="/profile/me/account" icon={<User className="h-4 w-4" />} iconToneClass="bg-[#5c8cff]/20 text-[#c8d9ff]" title="Аккаунт" subtitle="Имя, email, телефон, удаление" />
          <ProfileSettingsRow href="/profile/me/edit" icon={<Sparkles className="h-4 w-4" />} iconToneClass="bg-[#54a2ff]/20 text-[#d7ecff]" title="Профиль" subtitle="Фото, bio, факты, интересы, город" />
          <ProfileSettingsRow href="/profile/me/privacy" icon={<Shield className="h-4 w-4" />} iconToneClass="bg-[#52CC83]/20 text-[#d9ffe8]" title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" />
          <ProfileSettingsRow href="/profile/me/sessions" icon={<Monitor className="h-4 w-4" />} iconToneClass="bg-[#8f9cff]/20 text-[#e1e6ff]" title="Устройства и активные сессии" subtitle="Контроль входов" />
          <ProfileSettingsRow href="/profile/me/notifications" icon={<Bell className="h-4 w-4" />} iconToneClass="bg-[#6ec8ff]/20 text-[#ddf4ff]" title="Уведомления" subtitle="Коннекты, ответы, ивенты" />
          <ProfileSettingsRow href="/profile/me/preferences" icon={<Users className="h-4 w-4" />} iconToneClass="bg-[#74b6ff]/20 text-[#e1f0ff]" title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как match-имся" />
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
          <ProfileSettingsRow href="/profile/me/achievements" icon={<Trophy className="h-4 w-4" />} iconToneClass="bg-[#f1c05f]/20 text-[#ffecc8]" title="Достижения" subtitle="Яркие полученные и цели на будущее" />
          <ProfileSettingsRow href="/profile/me/help" icon={<CircleHelp className="h-4 w-4" />} iconToneClass="bg-[#56d0b0]/20 text-[#d9fff3]" title="Помощь / О приложении" subtitle="Как использовать профиль" />

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
