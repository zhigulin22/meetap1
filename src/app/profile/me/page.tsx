"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  Brain,
  Camera,
  ChevronRight,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagInput } from "@/components/tag-input";
import { api } from "@/lib/api-client";

const popularTags = [
  "дизайн",
  "маркетинг",
  "музыка",
  "стартапы",
  "спорт",
  "кино",
  "психология",
  "предпринимательство",
  "продукт",
  "фотография",
  "чтение",
  "кофе",
  "путешествия",
];

const schema = z.object({
  name: z.string().min(2).max(50),
  country: z.string().max(80).optional(),
  bio: z.string().max(320).optional(),
  university: z.string().max(120).optional(),
  work: z.string().max(120).optional(),
  facts: z.array(z.string().max(120)).min(3).max(3),
  interests: z.array(z.string().max(40)).min(3).max(20),
  hobbies: z.array(z.string().max(40)).max(20),
  preferences_mode: z.enum(["dating", "networking", "both"]),
  preferences_intent: z.string().max(120).optional(),
  preferences_meetupFrequency: z.enum(["low", "medium", "high"]),
  notifications_likes: z.boolean(),
  notifications_comments: z.boolean(),
  notifications_events: z.boolean(),
  notifications_connections: z.boolean(),
  notifications_digest: z.boolean(),
});

type FormValues = z.infer<typeof schema>;
type Section = "none" | "account" | "profile" | "privacy" | "preferences" | "activity" | "notifications" | "achievements" | "share";

function SettingsRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-black/10 px-3 py-3 text-left hover:bg-black/20"
    >
      <div className="rounded-xl border border-white/20 bg-black/25 p-2 text-muted">{icon}</div>
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
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [openSection, setOpenSection] = useState<Section>("none");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedFact, setSelectedFact] = useState(0);
  const [factsInput, setFactsInput] = useState<string[]>(["", "", ""]);
  const [privacy, setPrivacy] = useState({
    show_phone: false,
    show_facts: true,
    show_badges: true,
    show_last_active: true,
    show_event_history: true,
    show_city: true,
    show_work: true,
    show_university: true,
    who_can_message: "shared_events",
  });

  const profileQuery = useQuery({
    queryKey: ["me-v3"],
    queryFn: () => api<{ profile: any; activity: { posts: number; eventJoins: number; connections: number; reactions: number } }>("/api/profile/me"),
  });

  const badgesQuery = useQuery({
    queryKey: ["my-badges"],
    queryFn: () => api<{ featured: any; earned: any[]; available: any[] }>("/api/profile/badges"),
  });

  const privacyQuery = useQuery({
    queryKey: ["privacy-settings"],
    queryFn: () => api<{ settings: any }>("/api/profile/privacy"),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<{ items: Array<{ id: string; device_label: string; last_active_at: string }> }>("/api/auth/sessions"),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      country: "",
      bio: "",
      university: "",
      work: "",
      facts: ["", "", ""],
      interests: [],
      hobbies: [],
      preferences_mode: "both",
      preferences_intent: "",
      preferences_meetupFrequency: "medium",
      notifications_likes: true,
      notifications_comments: true,
      notifications_events: true,
      notifications_connections: true,
      notifications_digest: true,
    },
  });

  useEffect(() => {
    const t = (localStorage.getItem("theme") as "dark" | "light" | null) ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  useEffect(() => {
    const p = profileQuery.data?.profile;
    if (!p) return;

    setAvatarUrl(p.avatar_url ?? "");
    const facts = (p.facts ?? ["", "", ""]).slice(0, 3);
    while (facts.length < 3) facts.push("");
    setFactsInput(facts);

    form.reset({
      name: p.name ?? "",
      country: p.country ?? "",
      bio: p.bio ?? "",
      university: p.university ?? "",
      work: p.work ?? "",
      facts,
      interests: p.interests ?? [],
      hobbies: p.hobbies ?? [],
      preferences_mode: p.preferences?.mode ?? "both",
      preferences_intent: p.preferences?.intent ?? "",
      preferences_meetupFrequency: p.preferences?.meetupFrequency ?? "medium",
      notifications_likes: p.notification_settings?.likes ?? true,
      notifications_comments: p.notification_settings?.comments ?? true,
      notifications_events: p.notification_settings?.events ?? true,
      notifications_connections: p.notification_settings?.connections ?? true,
      notifications_digest: p.notification_settings?.weeklyDigest ?? true,
    });
  }, [profileQuery.data, form]);

  useEffect(() => {
    if (!privacyQuery.data?.settings) return;
    const raw = privacyQuery.data.settings;
    setPrivacy({ ...raw, who_can_message: raw.who_can_message === "verified" ? "shared_events" : raw.who_can_message });
  }, [privacyQuery.data]);

  const completion = useMemo(() => {
    const p = profileQuery.data?.profile;
    if (!p) return 0;
    let c = 0;
    if (p.avatar_url) c += 25;
    if (p.bio) c += 20;
    if ((p.interests ?? []).length >= 3) c += 20;
    if ((p.facts ?? []).length >= 3) c += 20;
    if (p.country) c += 15;
    return c;
  }, [profileQuery.data]);

  async function uploadAvatar(file: File) {
    try {
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api<{ url: string }>("/api/profile/avatar", { method: "POST", body: fd });
      setAvatarUrl(res.url);
      toast.success("Фото обновлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfilePart() {
    try {
      const values = form.getValues();
      const payload = {
        name: values.name,
        country: values.country,
        bio: values.bio,
        university: values.university,
        work: values.work,
        facts: factsInput,
        interests: values.interests,
        hobbies: values.hobbies,
        avatar_url: avatarUrl || undefined,
        preferences: {
          mode: values.preferences_mode,
          intent: values.preferences_intent,
          meetupFrequency: values.preferences_meetupFrequency,
        },
        notification_settings: {
          likes: values.notifications_likes,
          comments: values.notifications_comments,
          events: values.notifications_events,
          connections: values.notifications_connections,
          weeklyDigest: values.notifications_digest,
        },
      };

      const parsed = schema.safeParse({ ...values, facts: factsInput });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Проверь поля");
        return;
      }

      await api("/api/profile/me", { method: "PATCH", body: JSON.stringify(payload) });
      await profileQuery.refetch();
      toast.success("Сохранено");
      setOpenSection("none");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  async function savePrivacy() {
    try {
      await api("/api/profile/privacy", { method: "PUT", body: JSON.stringify(privacy) });
      toast.success("Настройки приватности сохранены");
      setOpenSection("none");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка приватности");
    }
  }

  async function featureBadge(badgeId: string) {
    await api("/api/profile/badges/feature", { method: "POST", body: JSON.stringify({ badgeId }) });
    await badgesQuery.refetch();
    toast.success("Бейдж закреплён");
  }

  async function revokeAllSessions() {
    await api("/api/auth/sessions", { method: "POST" });
    toast.success("Сессии закрыты");
    router.push("/login");
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/register");
  }

  async function deleteAccount() {
    if (!confirm("Удалить аккаунт безвозвратно?")) return;
    await api("/api/profile/account", { method: "DELETE" });
    router.push("/register");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  const profile = profileQuery.data?.profile;

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мой профиль</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="h-24 bg-[linear-gradient(125deg,rgba(8,18,42,0.96),rgba(82,204,131,0.32),rgba(77,125,223,0.5))]" />
        <CardContent className="-mt-10 p-4">
          <div className="flex items-end gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative">
              <Image src={avatarUrl || "https://placehold.co/120"} alt="avatar" width={120} height={120} className="h-20 w-20 rounded-3xl border-2 border-white/70 object-cover" unoptimized />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/60 p-1.5"><Camera className="h-3.5 w-3.5" /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <div>
              <p className="text-lg font-semibold">{profile?.name ?? "Пользователь"}</p>
              <p className="text-xs text-muted">{profile?.phone}</p>
              <p className="text-xs text-muted">Уровень {profile?.level ?? 1}</p>
              <p className="text-xs text-action">{uploadingAvatar ? "Загрузка фото..." : "Нажми, чтобы изменить фото"}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 rounded-xl border border-border bg-black/10 p-2">
            <p className="text-xs text-muted">Заполненность профиля</p>
            <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[linear-gradient(90deg,#52cc83,#6ec6ff)]" style={{ width: `${completion}%` }} /></div>
            <p className="text-xs">{completion}%</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block"><Button variant="secondary" className="w-full">Посмотреть как видят другие</Button></Link>
            {profile?.role === "admin" ? <Link href="/admin" className="block"><Button className="w-full">Admin</Button></Link> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle>Настройки</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <SettingsRow icon={<UserCircle className="h-4 w-4" />} title="Аккаунт" subtitle="Устройства, выход, удаление" onClick={() => setOpenSection("account")} />
          <SettingsRow icon={<Sparkles className="h-4 w-4" />} title="Профиль" subtitle="Имя, био, факты, интересы" onClick={() => setOpenSection("profile")} />
          <SettingsRow icon={<Shield className="h-4 w-4" />} title="Приватность и безопасность" subtitle="Кто видит данные и кто пишет" onClick={() => setOpenSection("privacy")} />
          <SettingsRow icon={<Users className="h-4 w-4" />} title="Знакомства/нетворкинг" subtitle="Режим и цель знакомств" onClick={() => setOpenSection("preferences")} />
          <SettingsRow icon={<UserCircle className="h-4 w-4" />} title="Активность" subtitle="Посты, ивенты, коннекты" onClick={() => setOpenSection("activity")} />
          <SettingsRow icon={<Bell className="h-4 w-4" />} title="Уведомления" subtitle="Комментарии, события, дайджест" onClick={() => setOpenSection("notifications")} />
          <SettingsRow icon={<Trophy className="h-4 w-4" />} title="Достижения" subtitle="Бейджи и закрепление" onClick={() => setOpenSection("achievements")} />
          <SettingsRow icon={<BadgeCheck className="h-4 w-4" />} title="Поделиться профилем" subtitle="Ссылка + превью" onClick={() => setOpenSection("share")} />
          <SettingsRow icon={<Brain className="h-4 w-4" />} title="Психотест" subtitle="Внутренний сигнал для алгоритмов" onClick={() => router.push("/profile/psych-test")} />
        </CardContent>
      </Card>

      <Dialog open={openSection === "profile"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Профиль</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Имя" {...form.register("name")} />
          <Input placeholder="Страна" {...form.register("country")} />
          <Textarea placeholder="Короткое био" {...form.register("bio")} />
          <Input placeholder="ВУЗ" {...form.register("university")} />
          <Input placeholder="Работа" {...form.register("work")} />
          <TagInput value={form.watch("interests") ?? []} onChange={(v) => form.setValue("interests", v, { shouldValidate: true })} suggestions={popularTags} min={3} max={20} placeholder="Добавь интерес и Enter" />
          <TagInput value={form.watch("hobbies") ?? []} onChange={(v) => form.setValue("hobbies", v)} suggestions={popularTags} max={20} placeholder="Хобби (опционально)" />

          <div className="rounded-xl border border-border bg-black/10 p-2">
            <p className="mb-1 text-xs text-muted">3 факта о себе (улучшают first-message conversion)</p>
            <div className="mb-2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <button key={i} type="button" onClick={() => setSelectedFact(i)} className={`rounded-full px-2 py-1 text-xs ${selectedFact === i ? "bg-action/20 text-action" : "bg-white/5 text-muted"}`}>Факт {i + 1}</button>
              ))}
            </div>
            <Textarea
              value={factsInput[selectedFact] ?? ""}
              onChange={(e) => {
                const next = [...factsInput];
                next[selectedFact] = e.target.value;
                setFactsInput(next);
              }}
              placeholder="Напиши факт"
            />
          </div>

          <Button className="w-full" onClick={saveProfilePart}>Сохранить</Button>
        </div>
      </Dialog>

      <Dialog open={openSection === "preferences"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Знакомства и нетворкинг</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <select {...form.register("preferences_mode")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
            <option value="both">Знакомства + нетворкинг</option>
            <option value="dating">Знакомства</option>
            <option value="networking">Нетворкинг</option>
          </select>
          <Input placeholder="Текущая цель (напр. найти партнёра по проекту)" {...form.register("preferences_intent")} />
          <select {...form.register("preferences_meetupFrequency")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
            <option value="low">Редко</option>
            <option value="medium">Средне</option>
            <option value="high">Часто</option>
          </select>
          <Button className="w-full" onClick={saveProfilePart}>Сохранить</Button>
        </div>
      </Dialog>

      <Dialog open={openSection === "privacy"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Приватность и безопасность</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            ["show_phone", "Показывать телефон"],
            ["show_facts", "Показывать 3 факта"],
            ["show_badges", "Показывать бейджи"],
            ["show_last_active", "Показывать статус активности"],
            ["show_event_history", "Показывать историю мероприятий"],
            ["show_city", "Показывать город"],
            ["show_work", "Показывать работу"],
            ["show_university", "Показывать ВУЗ"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-border bg-black/10 px-3 py-2">
              <input type="checkbox" checked={(privacy as any)[k]} onChange={(e) => setPrivacy((s: any) => ({ ...s, [k]: e.target.checked }))} /> {label}
            </label>
          ))}

          <div className="rounded-xl border border-border bg-black/10 p-2">
            <p className="mb-1 text-xs text-muted">Кто может писать</p>
            <select
              value={privacy.who_can_message}
              onChange={(e) => setPrivacy((s) => ({ ...s, who_can_message: e.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm"
            >
              <option value="everyone">Все</option>
              <option value="shared_events">Только участники общих событий</option>
              <option value="connections">Только connections</option>
            </select>
          </div>

          <Button className="w-full" onClick={savePrivacy}><Lock className="mr-1 h-4 w-4" />Сохранить приватность</Button>
        </div>
      </Dialog>

      <Dialog open={openSection === "notifications"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Уведомления</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            ["notifications_likes", "Лайки"],
            ["notifications_comments", "Комментарии"],
            ["notifications_events", "События"],
            ["notifications_connections", "Коннекты"],
            ["notifications_digest", "Недельный дайджест"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-border bg-black/10 px-3 py-2">
              <input type="checkbox" checked={(form.watch(k as any) as boolean) ?? false} onChange={(e) => form.setValue(k as any, e.target.checked)} /> {label}
            </label>
          ))}

          <Button className="w-full" onClick={saveProfilePart}>Сохранить</Button>
        </div>
      </Dialog>

      <Dialog open={openSection === "activity"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Активность</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border bg-black/10 p-3"><p className="text-xs text-muted">Посты</p><p className="text-xl font-semibold">{profileQuery.data?.activity.posts ?? 0}</p></div>
          <div className="rounded-xl border border-border bg-black/10 p-3"><p className="text-xs text-muted">Ивенты</p><p className="text-xl font-semibold">{profileQuery.data?.activity.eventJoins ?? 0}</p></div>
          <div className="rounded-xl border border-border bg-black/10 p-3"><p className="text-xs text-muted">Коннекты</p><p className="text-xl font-semibold">{profileQuery.data?.activity.connections ?? 0}</p></div>
          <div className="rounded-xl border border-border bg-black/10 p-3"><p className="text-xs text-muted">Реакции</p><p className="text-xl font-semibold">{profileQuery.data?.activity.reactions ?? 0}</p></div>
        </div>
      </Dialog>

      <Dialog open={openSection === "achievements"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Достижения</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {(badgesQuery.data?.earned ?? []).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-black/10 p-3">
              <div>
                <p className="text-sm font-medium">{b.badge?.title}</p>
                <p className="text-xs text-muted">{b.badge?.description}</p>
              </div>
              <Button size="sm" variant={b.is_featured ? "default" : "secondary"} onClick={() => featureBadge(b.badge?.id)}>
                {b.is_featured ? "Закреплён" : "Сделать главным"}
              </Button>
            </div>
          ))}

          {!badgesQuery.data?.earned?.length ? <p className="text-xs text-muted">Пока нет полученных бейджей.</p> : null}
        </div>
      </Dialog>

      <Dialog open={openSection === "share"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Поделиться профилем</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : "https://meetap1.vercel.app"}/profile/${profile?.id ?? ""}`} />
          <Button
            className="w-full"
            onClick={async () => {
              const url = `${window.location.origin}/profile/${profile?.id ?? ""}`;
              await navigator.clipboard.writeText(url);
              toast.success("Ссылка скопирована");
            }}
          >
            Копировать ссылку
          </Button>
        </div>
      </Dialog>

      <Dialog open={openSection === "account"} onOpenChange={(v) => !v && setOpenSection("none")}>
        <DialogHeader><DialogTitle>Аккаунт</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-black/10 p-3 text-xs">
            {(sessionsQuery.data?.items ?? []).map((s) => (
              <p key={s.id}>{s.device_label} · {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
            ))}
          </div>
          <Button variant="secondary" className="w-full" onClick={revokeAllSessions}>Закрыть все сессии</Button>
          <Button variant="secondary" className="w-full" onClick={logout}><LogOut className="mr-1 h-4 w-4" />Выйти</Button>
          <Button variant="danger" className="w-full" onClick={deleteAccount}>Удалить аккаунт</Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
