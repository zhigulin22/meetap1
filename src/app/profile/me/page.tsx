"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Moon,
  Sun,
  UserRound,
  BriefcaseBusiness,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Bell,
  Shield,
  Languages,
  HelpCircle,
  Brain,
  Camera,
  Lock,
  Smartphone,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type PsychProfile = {
  style?: string;
  traits?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  recommendations?: string[];
};

type PanelKey = "account" | "privacy" | "notifications" | "language" | "help" | "security";

function SettingsRow({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
        active
          ? "border-[#52cc83]/45 bg-[#52cc83]/12"
          : "border-border/70 bg-black/10 hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div className="rounded-xl border border-white/15 bg-black/25 p-2 text-muted">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted" />
    </button>
  );
}

export default function MyProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [panel, setPanel] = useState<PanelKey>("account");

  const [form, setForm] = useState({
    university: "",
    work: "",
    hobbies: "",
    interests: "",
    facts: "",
    avatar_url: "",
  });

  const { data, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          device_label: string;
          created_at: string;
          last_active_at: string;
          revoked_at: string | null;
        }>;
      }>("/api/auth/sessions"),
  });

  useEffect(() => {
    const t = (localStorage.getItem("theme") as "dark" | "light" | null) ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setForm({
      university: p.university ?? "",
      work: p.work ?? "",
      hobbies: (p.hobbies ?? []).join(", "),
      interests: (p.interests ?? []).join(", "),
      facts: (p.facts ?? []).join("\n"),
      avatar_url: p.avatar_url ?? "",
    });
  }, [data]);

  const psychProfile = useMemo(() => (data?.profile?.personality_profile ?? null) as PsychProfile | null, [data]);

  async function uploadAvatar(file: File) {
    try {
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api<{ url: string }>("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      setForm((s) => ({ ...s, avatar_url: res.url }));
      await refetch();
      toast.success("Фото профиля обновлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    const interests = form.interests
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const facts = form.facts
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (interests.length < 3) {
      toast.error("Нужно минимум 3 интереса");
      return;
    }

    if (facts.length < 3) {
      toast.error("Добавь 3 факта о себе");
      return;
    }

    try {
      await api("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          university: form.university,
          work: form.work,
          hobbies: form.hobbies
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          interests,
          facts,
          avatar_url: form.avatar_url || undefined,
        }),
      });
      await refetch();
      toast.success("Профиль сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  async function savePassword() {
    if (password.length < 8) {
      toast.error("Пароль должен быть минимум 8 символов");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Пароли не совпадают");
      return;
    }

    try {
      setSavingPassword(true);
      await api("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setPasswordConfirm("");
      await refetch();
      toast.success("Пароль обновлён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка установки пароля");
    } finally {
      setSavingPassword(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/register");
  }

  async function revokeAllSessions() {
    await api("/api/auth/sessions", { method: "POST" });
    toast.success("Все сессии закрыты");
    router.push("/login");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  const profile = data?.profile;

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профиль и настройки</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="mb-3 overflow-hidden border-white/15">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(4,12,38,0.95),rgba(82,204,131,0.33),rgba(58,104,255,0.48))]" />
        <CardContent className="-mt-10 p-4">
          <div className="flex items-end gap-3">
            <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Загрузить фото профиля">
              <Image
                src={form.avatar_url || "https://placehold.co/120"}
                alt={profile?.name ?? "avatar"}
                width={120}
                height={120}
                className="h-20 w-20 rounded-3xl border-2 border-white/70 object-cover shadow-xl"
                unoptimized
              />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/60 p-1.5">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />

            <div className="pb-1">
              <p className="text-lg font-semibold">{profile?.name ?? "Пользователь"}</p>
              <p className="text-xs text-muted">{profile?.phone ?? "Номер не указан"}</p>
              <p className="text-xs text-muted">Level {profile?.level ?? 1} · XP {profile?.xp ?? 0}</p>
              <p className="mt-1 text-xs text-action">
                {uploadingAvatar ? "Загружаем фото..." : "Нажми на фото, чтобы выбрать из галереи"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/profile/psych-test" className="block">
              <Button variant="secondary" className="w-full">
                <Brain className="mr-1 h-4 w-4" />
                Психотест
              </Button>
            </Link>
            <Button variant="secondary" onClick={logout}>Выйти</Button>
          </div>

          {profile?.role === "admin" ? (
            <div className="mt-2">
              <Link href="/admin" className="block">
                <Button className="w-full">Открыть Admin Panel</Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-2 p-3">
          <SettingsRow
            icon={<UserRound className="h-4 w-4" />}
            title="Аккаунт"
            subtitle="Имя, био, интересы, фото"
            active={panel === "account"}
            onClick={() => setPanel("account")}
          />
          <SettingsRow
            icon={<Shield className="h-4 w-4" />}
            title="Конфиденциальность"
            subtitle="Видимость и границы контактов"
            active={panel === "privacy"}
            onClick={() => setPanel("privacy")}
          />
          <SettingsRow
            icon={<Bell className="h-4 w-4" />}
            title="Уведомления"
            subtitle="Комментарии, события, коннекты"
            active={panel === "notifications"}
            onClick={() => setPanel("notifications")}
          />
          <SettingsRow
            icon={<Lock className="h-4 w-4" />}
            title="Безопасность"
            subtitle="Пароль и активные устройства"
            active={panel === "security"}
            onClick={() => setPanel("security")}
          />
          <SettingsRow
            icon={<Languages className="h-4 w-4" />}
            title="Язык"
            subtitle="Локализация интерфейса"
            active={panel === "language"}
            onClick={() => setPanel("language")}
          />
          <SettingsRow
            icon={<HelpCircle className="h-4 w-4" />}
            title="Помощь"
            subtitle="Поддержка и правила"
            active={panel === "help"}
            onClick={() => setPanel("help")}
          />
        </CardContent>
      </Card>

      {panel === "account" ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-muted">
                  <GraduationCap className="h-3.5 w-3.5" /> ВУЗ
                </label>
                <Input
                  value={form.university}
                  onChange={(e) => setForm((s) => ({ ...s, university: e.target.value }))}
                  placeholder="Университет"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-muted">
                  <BriefcaseBusiness className="h-3.5 w-3.5" /> Работа
                </label>
                <Input
                  value={form.work}
                  onChange={(e) => setForm((s) => ({ ...s, work: e.target.value }))}
                  placeholder="Компания / роль"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Хобби</label>
              <Input
                value={form.hobbies}
                onChange={(e) => setForm((s) => ({ ...s, hobbies: e.target.value }))}
                placeholder="кофе, бег, кино"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted">
                <Sparkles className="h-3.5 w-3.5" /> Интересы (минимум 3)
              </label>
              <Textarea
                value={form.interests}
                onChange={(e) => setForm((s) => ({ ...s, interests: e.target.value }))}
                placeholder="дизайн, маркетинг, музыка"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted">
                <UserRound className="h-3.5 w-3.5" /> 3 факта о себе
              </label>
              <Textarea
                value={form.facts}
                onChange={(e) => setForm((s) => ({ ...s, facts: e.target.value }))}
                placeholder={"Люблю офлайн встречи\nХожу на концерты\nРазвиваю pet-проекты"}
              />
            </div>

            <Button className="w-full" onClick={saveProfile}>Сохранить профиль</Button>
          </CardContent>
        </Card>
      ) : null}

      {panel === "privacy" ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium">Режим приватности</p>
            <p className="text-muted">В MVP доступна базовая логика: профиль виден участникам, если у вас есть активность в ленте.</p>
            <p className="text-muted">Скоро: скрытие последнего визита, ограничения по аудитории и персональные списки допуска.</p>
          </CardContent>
        </Card>
      ) : null}

      {panel === "notifications" ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium">Уведомления</p>
            <p className="text-muted">Системные тосты активны для комментариев, лайков, подключений и участия в ивентах.</p>
            <p className="text-muted">Дальше добавим granular переключатели и Telegram-напоминания.</p>
          </CardContent>
        </Card>
      ) : null}

      {panel === "language" ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium">Язык</p>
            <p className="text-muted">Сейчас основной язык интерфейса: русский.</p>
            <p className="text-muted">Поддержка EN будет вынесена в отдельный переключатель.</p>
          </CardContent>
        </Card>
      ) : null}

      {panel === "help" ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium">Помощь</p>
            <p className="text-muted">Если что-то не работает, напиши в поддержку и приложи скрин + шаги воспроизведения.</p>
            <p className="text-muted">Мы используем эти отчеты для приоритезации фиксов.</p>
          </CardContent>
        </Card>
      ) : null}

      {panel === "security" ? (
        <>
          <Card className="mb-3 border-white/15">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold">Быстрый вход по номеру и паролю</p>
              <p className="text-xs text-muted">
                {profile?.has_password
                  ? "Пароль уже установлен. Можно обновить его здесь."
                  : "Установи пароль один раз и входи по номеру + паролю с любого устройства."}
              </p>

              <Input
                type="password"
                placeholder="Новый пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Повтори пароль"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />

              <Button className="w-full" onClick={savePassword} disabled={savingPassword}>
                {savingPassword ? "Сохраняем..." : "Сохранить пароль"}
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-3 border-white/15">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-action" />
                <p className="text-sm font-semibold">Активные устройства</p>
              </div>
              {(sessionsQuery.data?.items ?? []).map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-black/10 p-3">
                  <p className="text-sm">{s.device_label}</p>
                  <p className="text-xs text-muted">Последняя активность: {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
                </div>
              ))}
              {!sessionsQuery.data?.items?.length ? <p className="text-xs text-muted">Сессий пока нет</p> : null}
              <Button variant="secondary" className="w-full" onClick={revokeAllSessions}>
                Закрыть все сессии
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      {psychProfile ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">Психопрофиль: {psychProfile.style ?? "Не определен"}</p>
            {psychProfile.traits ? (
              <p className="text-xs text-muted">
                O {psychProfile.traits.openness}% · C {psychProfile.traits.conscientiousness}% · E {psychProfile.traits.extraversion}% · A {psychProfile.traits.agreeableness}% · N {psychProfile.traits.neuroticism}%
              </p>
            ) : null}
            {psychProfile.recommendations?.map((x) => (
              <p key={x} className="text-xs text-muted">• {x}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
