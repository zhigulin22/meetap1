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
import { Pill } from "@/components/ui/pill";
import { ProfileSettingsRow } from "@/components/profile-settings-row";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";
import { TopBar } from "@/components/top-bar";
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
    queryKey: ["profile-me-hub-v6"],
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
  const mood = profile?.preferences?.mood || profile?.mood || null;
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
      <TopBar title="Мой профиль" subtitle="Управление аккаунтом и настройками в одном месте" right={<Pill>settings hub</Pill>} />

      <Card className="mb-3 overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <div className="relative h-[21rem] overflow-hidden border-b border-[color:var(--border-soft)]" style={{ background: themeGradient }}>
          <div className="absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.32),transparent_68%)]" />
          <div className="absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--teal-rgb)/0.28),transparent_68%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgb(var(--text-rgb)/0.14),transparent_58%)]" />

          <div className="absolute inset-x-0 bottom-4 z-10 text-center">
            <Image
              src={profile?.avatar_url || "https://placehold.co/560x560"}
              alt="avatar"
              width={240}
              height={240}
              unoptimized
              className="mx-auto h-44 w-44 rounded-[40px] border-2 border-[rgb(var(--border-strong-rgb)/0.5)] object-cover shadow-[0_22px_54px_rgba(5,12,28,0.45)]"
            />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.68)] px-3 py-1.5 backdrop-blur-xl">
              <p className="text-[1.05rem] font-semibold leading-none text-text">{profile?.name || "Пользователь"}</p>
              <ProfileEmojiBadge value={profile?.preferences?.profileEmoji} />
              {profile?.telegram_verified ? (
                <span title="Телефон подтвержден">
                  <CheckCircle2 className="h-4 w-4 text-mint" />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text2">{maskPhone(profile?.phone)} · {profile?.city || "Город не указан"}</p>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.74)] px-3 py-2">
              <p className="text-[11px] text-text2">Публикации</p>
              <p className="text-[18px] font-semibold leading-none text-text">{activity?.posts ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.74)] px-3 py-2">
              <p className="text-[11px] text-text2">Посещено ивентов</p>
              <p className="text-[18px] font-semibold leading-none text-text">{activity?.eventJoins ?? 0}</p>
            </div>
          </div>

          {mood ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--sky-rgb)/0.36)] bg-[linear-gradient(120deg,rgb(var(--sky-rgb)/0.18),rgb(var(--teal-rgb)/0.15))] px-3 py-1 text-xs text-text">
              <Sparkles className="h-3.5 w-3.5" /> Настроение: {mood}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.74)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text2">Profile Quality</p>
              <p className="text-xs font-semibold text-text">{completion}%</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[rgb(var(--surface-2-rgb)/0.82)]">
              <motion.div
                initial={false}
                animate={{ width: `${completion}%` }}
                className="h-2 rounded-full bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--teal-rgb)))]"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {qualityItems.map((item) => (
                <div
                  key={item.key}
                  className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                    item.done
                      ? "border-[rgb(var(--teal-rgb)/0.4)] bg-[rgb(var(--teal-rgb)/0.14)] text-[rgb(var(--teal-rgb))]"
                      : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.6)] text-text2"
                  }`}
                >
                  {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current" />} {item.label}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-text3">Чем выше заполненность, тем точнее рекомендации и первые сообщения.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block">
              <Button variant="secondary" className="h-11 w-full">Как видят другие</Button>
            </Link>
            <Link href="/profile/me/edit" className="block">
              <Button variant="secondary" className="h-11 w-full">Редактировать</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {!psychCompleted && showPsychCard ? (
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.35)] bg-[linear-gradient(120deg,rgb(var(--sky-rgb)/0.16),rgb(var(--teal-rgb)/0.14))]">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-text">Психотест ещё не пройден</p>
            <p className="text-xs text-text2">После теста алгоритм точнее подбирает людей и дает полезные подсказки знакомства.</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/profile/me/psych-test" className="block">
                <Button className="w-full">Пройти сейчас</Button>
              </Link>
              <Button variant="secondary" className="w-full" onClick={remindLater}>Напомнить позже</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canOpenAdmin ? (
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.32)] bg-[rgb(var(--sky-rgb)/0.1)]">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-text">Админ-панель доступна</p>
              <p className="text-xs text-text2">Модерация, метрики, роли и операционный контроль</p>
            </div>
            <Link href="/admin" className="shrink-0">
              <Button>
                <ShieldCheck className="mr-1 h-4 w-4" /> Открыть Admin
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.24)] bg-[rgb(var(--sky-rgb)/0.08)]">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium text-text">Нет кнопки Admin?</p>
              <p className="text-xs text-text2">Нажми один раз, если этот аккаунт должен быть админом.</p>
            </div>
            <Button onClick={activateAdminAccess} disabled={activatingAdmin}>
              <ShieldCheck className="mr-1 h-4 w-4" /> {activatingAdmin ? "Активируем..." : "Активировать админ-доступ"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.88)]">
        <CardHeader>
          <CardTitle className="text-text">Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileSettingsRow href="/profile/me/account" icon={<User className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--sky-rgb)/0.95),rgb(var(--sky-rgb)/0.72))] text-[rgb(var(--text-rgb))]" title="Аккаунт" subtitle="Имя, email, телефон, удаление" />
          <ProfileSettingsRow href="/profile/me/edit" icon={<Sparkles className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--teal-rgb)/0.96),rgb(var(--teal-rgb)/0.72))] text-[rgb(var(--bg-rgb))]" title="Профиль" subtitle="Фото, bio, факты, интересы, город" />
          <ProfileSettingsRow href="/profile/me/privacy" icon={<Shield className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--violet-rgb)/0.95),rgb(var(--violet-rgb)/0.72))] text-[rgb(var(--text-rgb))]" title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" />
          <ProfileSettingsRow href="/profile/me/sessions" icon={<Monitor className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--teal-rgb)/0.9),rgb(var(--sky-rgb)/0.72))] text-[rgb(var(--bg-rgb))]" title="Устройства и активные сессии" subtitle="Управление входами, завершение сессий" />
          <ProfileSettingsRow href="/profile/me/notifications" icon={<Bell className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--amber-rgb)/0.95),rgb(var(--amber-rgb)/0.72))] text-[rgb(var(--bg-rgb))]" title="Уведомления" subtitle="Коннекты, ответы, ивенты" />
          <ProfileSettingsRow href="/profile/me/preferences" icon={<Users className="h-4 w-4" />} iconToneClass="bg-[image:var(--grad-primary)] text-[rgb(var(--bg-rgb))]" title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как match-имся" />
          <ProfileSettingsRow
            href="/profile/me/psych-test"
            icon={<Brain className="h-4 w-4" />}
            iconToneClass="bg-[linear-gradient(135deg,rgb(var(--violet-rgb)/0.88),rgb(var(--sky-rgb)/0.6))] text-[rgb(var(--text-rgb))]"
            title="Психотест"
            subtitle={psychCompleted ? "Пройден, можно обновить" : "Не пройден — влияет на качество рекомендаций"}
            badge={
              psychCompleted ? (
                <span className="rounded-full border border-mint/40 bg-mint/12 px-2 py-0.5 text-[10px] text-mint/90">OK</span>
              ) : (
                <span className="rounded-full border border-amber/50 bg-amber/12 px-2 py-0.5 text-[10px] text-amber/90">Важно</span>
              )
            }
          />
          <ProfileSettingsRow href="/profile/me/achievements" icon={<Trophy className="h-4 w-4" />} iconToneClass="bg-[image:var(--grad-badge)] text-[rgb(var(--bg-rgb))]" title="Достижения" subtitle="Яркие полученные и цели на будущее" />
          <ProfileSettingsRow href="/profile/me/help" icon={<CircleHelp className="h-4 w-4" />} iconToneClass="bg-[linear-gradient(135deg,rgb(var(--surface-3-rgb)/0.95),rgb(var(--surface-3-rgb)/0.7))] text-[rgb(var(--text-rgb))]" title="Помощь / О приложении" subtitle="Как использовать профиль" />

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
