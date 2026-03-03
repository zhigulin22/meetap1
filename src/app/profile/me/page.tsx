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
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileSettingsRow } from "@/components/profile-settings-row";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api-client";

const PSYCH_REMINDER_KEY = "meetap_psych_reminder_until";
const PSYCH_REMINDER_DAYS = 7;

export default function MyProfileHubPage() {
  const router = useRouter();
  const [showPsychCard, setShowPsychCard] = useState(false);
  const [activatingAdmin, setActivatingAdmin] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-me-hub-v7"],
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
      { key: "photo", label: "Фото", done: Boolean(profile?.avatar_url), cta: "/profile/me/edit" },
      { key: "facts", label: "Факты", done: (profile?.facts ?? []).length >= 2, cta: "/profile/me/edit" },
      { key: "interests", label: "Интересы", done: (profile?.interests ?? []).length >= 3, cta: "/profile/me/edit" },
      { key: "bio", label: "Bio", done: Boolean(profile?.bio), cta: "/profile/me/edit" },
      { key: "context", label: "Профконтекст", done: hasProfessionalContext, cta: "/profile/me/edit" },
      { key: "psych", label: "Психотест", done: psychCompleted, cta: "/profile/me/psych-test" },
    ];
  }, [profile, psychCompleted]);

  const completion = useMemo(() => {
    if (!qualityItems.length) return 0;
    const done = qualityItems.filter((x) => x.done).length;
    return Math.round((done / qualityItems.length) * 100);
  }, [qualityItems]);

  const nextIncomplete = useMemo(() => qualityItems.find((x) => !x.done) ?? null, [qualityItems]);

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
      <TopBar title="Мой профиль" subtitle="Управление аккаунтом и настройками" right={<Pill>telegram-style</Pill>} />

      <Card className="mb-3 overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.98)]">
        <div className="relative h-[21rem] overflow-hidden border-b border-[color:var(--border-soft)] bg-[#F5FFFB]">
          <div className="pointer-events-none absolute -left-20 top-[48%] h-80 w-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_240_235/0.6),transparent_64%)] blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-[42%] h-96 w-96 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(231_255_247/0.55),transparent_66%)] blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgb(255_255_255/0.56),transparent_58%)]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.018] mix-blend-multiply"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(18 32 28 / 0.55) 1px, transparent 0)",
              backgroundSize: "3px 3px",
            }}
          />

          <div className="absolute inset-x-0 bottom-5 z-10 px-4">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="rounded-full bg-[image:var(--grad-primary)] p-[3px] shadow-[0_14px_34px_rgba(18,32,28,0.18)]">
                <div className="rounded-full bg-white p-[2px]">
                  <Image
                    src={profile?.avatar_url || "https://placehold.co/560x560"}
                    alt="avatar"
                    width={240}
                    height={240}
                    unoptimized
                    className="h-28 w-28 rounded-full object-cover"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-[1.68rem] font-semibold leading-none text-text">{profile?.name || "Пользователь"}</h1>
                <ProfileEmojiBadge value={profile?.preferences?.profileEmoji} />
                {profile?.telegram_verified ? (
                  <span title="Телефон подтвержден">
                    <CheckCircle2 className="h-4 w-4 text-[rgb(var(--teal-rgb))]" />
                  </span>
                ) : null}
              </div>

              {profile?.city ? <p className="mt-1 text-xs text-text2">{profile.city}</p> : null}
            </div>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[rgb(var(--peach-rgb)/0.24)] bg-[rgb(255_240_235/0.88)] px-3 py-2">
              <p className="text-[11px] text-[rgb(var(--text-2-rgb))]">Публикации</p>
              <p className="text-[20px] font-semibold leading-none text-[rgb(var(--text-rgb))]">{activity?.posts ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--peach-rgb)/0.24)] bg-[rgb(255_240_235/0.88)] px-3 py-2">
              <p className="text-[11px] text-[rgb(var(--text-2-rgb))]">Посещено ивентов</p>
              <p className="text-[20px] font-semibold leading-none text-[rgb(var(--text-rgb))]">{activity?.eventJoins ?? 0}</p>
            </div>
          </div>

          {mood ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--teal-rgb)/0.32)] bg-[rgb(var(--teal-rgb)/0.1)] px-3 py-1 text-xs text-[rgb(var(--teal-hover-rgb))]">
              <Sparkles className="h-3.5 w-3.5" /> Настроение: {mood}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block">
              <Button variant="secondary" className="h-11 w-full border-[rgb(var(--teal-rgb)/0.35)] bg-white text-[rgb(var(--text-rgb))] hover:bg-[rgb(var(--mint-rgb)/0.22)]">Как видят другие</Button>
            </Link>
            <Link href="/profile/me/edit" className="block">
              <Button className="h-11 w-full text-base font-semibold">Редактировать</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {completion < 100 ? (
        <Card className="mb-3 border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--mint-rgb)/0.1)]">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text">Улучшить профиль</p>
              <Pill tone="mint">{completion}%</Pill>
            </div>
            <div className="h-2 rounded-full bg-[rgb(var(--surface-1-rgb)/0.9)]">
              <div className="h-2 rounded-full bg-[image:var(--grad-primary)]" style={{ width: `${completion}%` }} />
            </div>
            <p className="text-xs text-text2">{nextIncomplete ? `Следующий шаг: ${nextIncomplete.label}` : "Проверь обязательные поля"}</p>
            <Button variant="secondary" className="w-full" onClick={() => setQualityOpen(true)}>
              Открыть чеклист
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--teal-rgb)/0.08)] px-3 py-1 text-xs text-[rgb(var(--teal-hover-rgb))]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Профиль заполнен на 100%
        </div>
      )}

      {!psychCompleted && showPsychCard ? (
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.3)] bg-[rgb(var(--sky-rgb)/0.1)]">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-text">Психотест еще не пройден</p>
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
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.28)] bg-[rgb(var(--sky-rgb)/0.08)]">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--peach-rgb))]">Админ-панель доступна</p>
              <p className="text-xs text-text2">Модерация, метрики, роли и операционный контроль</p>
            </div>
            <Link href="/admin" className="shrink-0">
              <Button className="text-base font-semibold">
                <ShieldCheck className="mr-1 h-4 w-4" /> Открыть Admin
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-3 border-[rgb(var(--sky-rgb)/0.22)] bg-[rgb(var(--sky-rgb)/0.06)]">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--peach-rgb))]">Нет кнопки Admin?</p>
              <p className="text-xs text-text2">Нажми один раз, если этот аккаунт должен быть админом.</p>
            </div>
            <Button onClick={activateAdminAccess} disabled={activatingAdmin} className="text-base font-semibold">
              <ShieldCheck className="mr-1 h-4 w-4" /> {activatingAdmin ? "Активируем..." : "Активировать админ-доступ"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.96)]">
        <CardHeader>
          <CardTitle className="text-[rgb(var(--peach-rgb))]">Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileSettingsRow href="/profile/me/account" icon={<User className="h-4 w-4" />} iconToneClass="border border-[#2AB3FF]/40 bg-[#2AB3FF]/25 text-white" title="Аккаунт" subtitle="Имя, email, телефон, удаление" />
          <ProfileSettingsRow href="/profile/me/edit" icon={<Sparkles className="h-4 w-4" />} iconToneClass="border border-[#00D2A8]/40 bg-[#00D2A8]/25 text-white" title="Профиль" subtitle="Фото, bio, факты, интересы, город" />
          <ProfileSettingsRow href="/profile/me/privacy" icon={<Shield className="h-4 w-4" />} iconToneClass="border border-[#6C4DFF]/40 bg-[#6C4DFF]/25 text-white" title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" />
          <ProfileSettingsRow href="/profile/me/sessions" icon={<Monitor className="h-4 w-4" />} iconToneClass="border border-[#2AB3FF]/40 bg-[#2AB3FF]/25 text-white" title="Устройства и активные сессии" subtitle="Управление входами, завершение сессий" />
          <ProfileSettingsRow href="/profile/me/notifications" icon={<Bell className="h-4 w-4" />} iconToneClass="border border-[#F7C948]/40 bg-[#F7C948]/25 text-white" title="Уведомления" subtitle="Коннекты, ответы, ивенты" />
          <ProfileSettingsRow href="/profile/me/preferences" icon={<Users className="h-4 w-4" />} iconToneClass="border border-[#00D2A8]/40 bg-[#00D2A8]/25 text-white" title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как match-имся" />
          <ProfileSettingsRow
            href="/profile/me/psych-test"
            icon={<Brain className="h-4 w-4" />}
            iconToneClass="border border-[#6C4DFF]/40 bg-[#6C4DFF]/25 text-white"
            title="Психотест"
            subtitle={psychCompleted ? "Пройден, можно обновить" : "Не пройден — влияет на качество рекомендаций"}
            badge={
              psychCompleted ? (
                <span className="rounded-full border border-[rgb(var(--teal-rgb)/0.4)] bg-[rgb(var(--teal-rgb)/0.12)] px-2 py-0.5 text-[10px] text-[rgb(var(--teal-hover-rgb))]">OK</span>
              ) : (
                <span className="rounded-full border border-[rgb(var(--amber-rgb)/0.5)] bg-[rgb(var(--amber-rgb)/0.12)] px-2 py-0.5 text-[10px] text-[rgb(160,98,0)]">Важно</span>
              )
            }
          />
          <ProfileSettingsRow href="/profile/me/achievements" icon={<Trophy className="h-4 w-4" />} iconToneClass="border border-[#F7C948]/40 bg-[#F7C948]/25 text-white" title="Достижения" subtitle="Яркие полученные и цели на будущее" />
          <ProfileSettingsRow href="/profile/me/help" icon={<CircleHelp className="h-4 w-4" />} iconToneClass="border border-[#2AB3FF]/40 bg-[#2AB3FF]/25 text-white" title="Помощь / О приложении" subtitle="Как использовать профиль" />

          <button
            type="button"
            onClick={logout}
            className="mt-1 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FF3B5C]/40 bg-[#FF3B5C]/12 text-sm font-semibold text-[#FF3B5C] transition active:scale-[0.988]"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </CardContent>
      </Card>

      <Dialog open={qualityOpen} onOpenChange={setQualityOpen}>
        <DialogHeader>
          <DialogTitle>Чеклист профиля</DialogTitle>
        </DialogHeader>
        <div className="max-h-[74vh] space-y-2 overflow-y-auto">
          {qualityItems.map((item) => (
            <Link key={item.key} href={item.cta} onClick={() => setQualityOpen(false)}>
              <div className={`tap-press flex items-center justify-between rounded-xl border px-3 py-2 ${item.done ? "border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--teal-rgb)/0.08)]" : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.68)]"}`}>
                <p className="text-sm text-text">{item.label}</p>
                {item.done ? <span className="text-xs text-[rgb(var(--teal-hover-rgb))]">Готово</span> : <span className="text-xs text-text2">Заполнить</span>}
              </div>
            </Link>
          ))}
        </div>
      </Dialog>
    </PageShell>
  );
}
