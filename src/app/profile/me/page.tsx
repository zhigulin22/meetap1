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
  Cloud,
  HelpCircle,
  Brain,
  Camera,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type PsychProfile = {
  instrument?: string;
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

function SettingsRow({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-black/10 px-3 py-3 text-left hover:bg-white/5">
      <div className="rounded-xl border border-white/20 bg-black/20 p-2 text-muted">{icon}</div>
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
    queryFn: () => api<{ items: Array<{ id: string; device_label: string; created_at: string; last_active_at: string; revoked_at: string | null }> }>("/api/auth/sessions"),
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    const interests = form.interests.split(",").map((x) => x.trim()).filter(Boolean);
    const facts = form.facts.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3);

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
          hobbies: form.hobbies.split(",").map((x) => x.trim()).filter(Boolean),
          interests,
          facts,
          avatar_url: form.avatar_url || undefined,
        }),
      });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
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
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="mb-3 overflow-hidden border-white/15">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(8,14,47,0.95),rgba(82,204,131,0.35),rgba(73,111,236,0.55))]" />
        <CardContent className="-mt-10 p-4">
          <div className="flex items-end gap-3">
            <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Загрузить фото профиля">
              <Image
                src={form.avatar_url || "https://placehold.co/120"}
                alt={profile?.name ?? "avatar"}
                width={120}
                height={120}
                className="h-20 w-20 rounded-2xl border-2 border-white/70 object-cover shadow-xl"
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
        </CardContent>
      </Card>

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

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-2 p-3">
          <SettingsRow icon={<UserRound className="h-4 w-4" />} title="Аккаунт" subtitle="Имя, номер, username, фото" />
          <SettingsRow icon={<Shield className="h-4 w-4" />} title="Конфиденциальность" subtitle="Кто видит профиль и активность" />
          <SettingsRow icon={<Bell className="h-4 w-4" />} title="Уведомления" subtitle="Сообщения, лайки, события" />
          <SettingsRow icon={<Cloud className="h-4 w-4" />} title="Данные и хранилище" subtitle="Фото, кэш, медиаданные" />
          <SettingsRow icon={<Languages className="h-4 w-4" />} title="Язык" subtitle="Русский" />
          <SettingsRow icon={<HelpCircle className="h-4 w-4" />} title="Помощь" subtitle="FAQ, поддержка, политика" />
        </CardContent>
      </Card>

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted"><GraduationCap className="h-3.5 w-3.5" /> ВУЗ</label>
              <Input value={form.university} onChange={(e) => setForm((s) => ({ ...s, university: e.target.value }))} placeholder="Университет" />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted"><BriefcaseBusiness className="h-3.5 w-3.5" /> Работа</label>
              <Input value={form.work} onChange={(e) => setForm((s) => ({ ...s, work: e.target.value }))} placeholder="Компания / роль" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted">Хобби</label>
            <Input value={form.hobbies} onChange={(e) => setForm((s) => ({ ...s, hobbies: e.target.value }))} placeholder="кофе, бег, кино" />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs text-muted"><Sparkles className="h-3.5 w-3.5" /> Интересы (минимум 3)</label>
            <Textarea value={form.interests} onChange={(e) => setForm((s) => ({ ...s, interests: e.target.value }))} placeholder="дизайн, маркетинг, музыка" />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs text-muted"><UserRound className="h-3.5 w-3.5" /> 3 факта о себе</label>
            <Textarea value={form.facts} onChange={(e) => setForm((s) => ({ ...s, facts: e.target.value }))} placeholder={"Люблю офлайн встречи\nХожу на концерты\nРазвиваю pet-проекты"} />
          </div>

          <Button className="w-full" onClick={save}>Сохранить профиль</Button>
        </CardContent>
      </Card>

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Активные устройства</p>
          {(sessionsQuery.data?.items ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-black/10 p-2">
              <p className="text-sm">{s.device_label}</p>
              <p className="text-xs text-muted">Последняя активность: {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
            </div>
          ))}
          {!sessionsQuery.data?.items?.length ? <p className="text-xs text-muted">Сессий пока нет</p> : null}
          <Button variant="secondary" className="w-full" onClick={revokeAllSessions}>Закрыть все сессии</Button>
        </CardContent>
      </Card>

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Быстрый вход по номеру и паролю</p>
          <p className="text-xs text-muted">
            {profile?.has_password
              ? "Пароль уже установлен. Можно обновить его здесь."
              : "Установи пароль, чтобы входить без повторной Telegram-верификации."}
          </p>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Новый пароль" />
          <Input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Повтори пароль" />
          <Button
            onClick={savePassword}
            disabled={savingPassword || password.length < 8 || passwordConfirm.length < 8}
            className="w-full"
          >
            {savingPassword ? "Сохраняем..." : "Сохранить пароль"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
