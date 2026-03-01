"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  Camera,
  ChevronRight,
  CircleHelp,
  Globe,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  User,
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
  "AI",
  "финансы",
  "креатив",
];

type SectionKey =
  | "none"
  | "account"
  | "profile"
  | "privacy"
  | "devices"
  | "notifications"
  | "networking"
  | "achievements"
  | "about";

type Draft = {
  name: string;
  username: string;
  email: string;
  phone: string;
  avatar_url: string;
  bio: string;
  country: string;
  city: string;
  university: string;
  work: string;
  facts: string[];
  interests: string[];
  hobbies: string[];
  preferences_mode: "dating" | "networking" | "both";
  preferences_intent: string;
  preferences_meetupFrequency: "low" | "medium" | "high";
  preferences_lookingFor: string[];
  notifications_likes: boolean;
  notifications_comments: boolean;
  notifications_events: boolean;
  notifications_connections: boolean;
  notifications_digest: boolean;
  notifications_push: boolean;
  notifications_email: boolean;
};

type PrivacySettings = {
  phone_visibility: "nobody" | "everyone" | "contacts";
  show_facts: boolean;
  show_interests: boolean;
  show_event_history: boolean;
  show_city: boolean;
  show_work: boolean;
  show_university: boolean;
  show_last_active: boolean;
  who_can_message: "everyone" | "shared_events" | "connections";
  blocked_user_ids: string[];
  show_badges: boolean;
};

const defaultDraft: Draft = {
  name: "",
  username: "",
  email: "",
  phone: "",
  avatar_url: "",
  bio: "",
  country: "",
  city: "",
  university: "",
  work: "",
  facts: ["", "", ""],
  interests: [],
  hobbies: [],
  preferences_mode: "both",
  preferences_intent: "",
  preferences_meetupFrequency: "medium",
  preferences_lookingFor: ["друзья", "нетворк"],
  notifications_likes: true,
  notifications_comments: true,
  notifications_events: true,
  notifications_connections: true,
  notifications_digest: true,
  notifications_push: true,
  notifications_email: false,
};

const defaultPrivacy: PrivacySettings = {
  phone_visibility: "nobody",
  show_facts: true,
  show_interests: true,
  show_event_history: true,
  show_city: true,
  show_work: true,
  show_university: true,
  show_last_active: true,
  who_can_message: "shared_events",
  blocked_user_ids: [],
  show_badges: true,
};

const accountSchema = z.object({
  name: z.string().trim().min(2, "Имя минимум 2 символа").max(50),
  username: z.string().trim().max(32).optional(),
  email: z
    .string()
    .trim()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Некорректный email")
    .optional(),
});

const profileSchema = z.object({
  bio: z.string().trim().max(320, "Био слишком длинное"),
  country: z.string().trim().min(2, "Укажи страну"),
  city: z.string().trim().min(2, "Укажи город"),
  university: z.string().trim().min(2, "ВУЗ нужен для рекомендаций"),
  work: z.string().trim().min(2, "Работа нужна для рекомендаций"),
  facts: z.array(z.string().trim().min(2, "Факт слишком короткий").max(120)).min(2).max(3),
  interests: z.array(z.string().trim().min(2).max(40)).min(3, "Минимум 3 интереса").max(20),
  hobbies: z.array(z.string().trim().max(40)).max(20),
});

const notificationsSchema = z.object({
  notifications_likes: z.boolean(),
  notifications_comments: z.boolean(),
  notifications_events: z.boolean(),
  notifications_connections: z.boolean(),
  notifications_digest: z.boolean(),
  notifications_push: z.boolean(),
  notifications_email: z.boolean(),
});

const preferencesSchema = z.object({
  preferences_mode: z.enum(["dating", "networking", "both"]),
  preferences_intent: z.string().trim().max(120),
  preferences_meetupFrequency: z.enum(["low", "medium", "high"]),
  preferences_lookingFor: z.array(z.string().trim().max(40)).min(1).max(6),
});

const privacySchema = z.object({
  phone_visibility: z.enum(["nobody", "everyone", "contacts"]),
  show_facts: z.boolean(),
  show_interests: z.boolean(),
  show_event_history: z.boolean(),
  show_city: z.boolean(),
  show_work: z.boolean(),
  show_university: z.boolean(),
  show_last_active: z.boolean(),
  who_can_message: z.enum(["everyone", "shared_events", "connections"]),
  blocked_user_ids: z.array(z.string().uuid()),
  show_badges: z.boolean(),
});

function maskPhone(phone: string) {
  const clean = (phone ?? "").replace(/\s/g, "");
  if (!clean) return "Не указан";
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 3)} *** ${clean.slice(-2)}`;
}

function boolLabel(v: boolean) {
  return v ? "Включено" : "Выключено";
}

function RowButton({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-border bg-surface2/70 px-4 py-3 text-left transition active:scale-[0.99] hover:border-white/20"
    >
      <div className="rounded-xl border border-white/15 bg-black/15 p-2 text-muted">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted transition group-hover:text-text" />
    </button>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface2/70 px-3 py-2">
      <div>
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#52CC83]" />
    </label>
  );
}

function SettingsSheet({
  open,
  onClose,
  title,
  subtitle,
  right,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
          </div>
          {right ?? null}
        </div>
      </DialogHeader>
      <div className="max-h-[calc(90vh-108px)] space-y-3 overflow-y-auto pb-2 pr-1">{children}</div>
    </Dialog>
  );
}

export default function MyProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [section, setSection] = useState<SectionKey>("none");
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-me-v4"],
    queryFn: () => api<{ profile: any; activity: { posts: number; eventJoins: number; connections: number; reactions: number } }>("/api/profile/me"),
  });

  const privacyQuery = useQuery({
    queryKey: ["profile-privacy-v2"],
    queryFn: () => api<{ settings: PrivacySettings; blocked_users: Array<{ id: string; name: string; avatar_url: string | null }> }>("/api/profile/privacy"),
  });

  const sessionsQuery = useQuery({
    queryKey: ["profile-sessions-v1"],
    queryFn: () =>
      api<{
        current_session_id: string | null;
        current: any | null;
        items: Array<{
          id: string;
          device_label: string;
          user_agent: string | null;
          approx_location: string | null;
          created_at: string;
          last_active_at: string;
          revoked_at: string | null;
          is_current: boolean;
        }>;
      }>("/api/profile/sessions"),
  });

  useEffect(() => {
    const p = meQuery.data?.profile;
    if (!p) return;

    const facts = (Array.isArray(p.facts) ? p.facts : []).slice(0, 3);
    while (facts.length < 3) facts.push("");

    setDraft({
      name: p.name ?? "",
      username: typeof p.username === "string" ? p.username : "",
      email: typeof p.email === "string" ? p.email : "",
      phone: p.phone ?? "",
      avatar_url: p.avatar_url ?? "",
      bio: p.bio ?? "",
      country: p.country ?? "",
      city: p.city ?? "",
      university: p.university ?? "",
      work: p.work ?? "",
      facts,
      interests: Array.isArray(p.interests) ? p.interests : [],
      hobbies: Array.isArray(p.hobbies) ? p.hobbies : [],
      preferences_mode: p.preferences?.mode ?? "both",
      preferences_intent: p.preferences?.intent ?? "",
      preferences_meetupFrequency: p.preferences?.meetupFrequency ?? "medium",
      preferences_lookingFor: Array.isArray(p.preferences?.lookingFor) ? p.preferences.lookingFor : ["друзья", "нетворк"],
      notifications_likes: p.notification_settings?.likes ?? true,
      notifications_comments: p.notification_settings?.comments ?? true,
      notifications_events: p.notification_settings?.events ?? true,
      notifications_connections: p.notification_settings?.connections ?? true,
      notifications_digest: p.notification_settings?.weeklyDigest ?? true,
      notifications_push: p.notification_settings?.push ?? true,
      notifications_email: p.notification_settings?.email ?? false,
    });
  }, [meQuery.data]);

  useEffect(() => {
    if (!privacyQuery.data?.settings) return;
    setPrivacy(privacyQuery.data.settings);
  }, [privacyQuery.data]);

  function markSaved(next: SectionKey) {
    setSavedSection(next);
    setTimeout(() => setSavedSection((current) => (current === next ? null : current)), 2200);
  }

  function setError(path: string, message: string) {
    setFieldErrors((prev) => ({ ...prev, [path]: message }));
  }

  function clearError(path: string) {
    setFieldErrors((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }

  async function saveAccount() {
    const payload = { name: draft.name, username: draft.username || undefined, email: draft.email || undefined };
    const parsed = accountSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors({ account: parsed.error.issues[0]?.message ?? "Проверь поля аккаунта" });
      return;
    }

    try {
      setSavingSection("account");
      const updatePayload: Record<string, any> = { name: parsed.data.name };
      if ("username" in (meQuery.data?.profile ?? {})) updatePayload.username = parsed.data.username || null;
      if ("email" in (meQuery.data?.profile ?? {})) updatePayload.email = parsed.data.email || null;

      await api("/api/profile/me", { method: "PUT", body: JSON.stringify(updatePayload) });
      await meQuery.refetch();
      markSaved("account");
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ account: e instanceof Error ? e.message : "Не удалось сохранить аккаунт" });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveProfile() {
    const normalizedFacts = draft.facts.map((x) => x.trim()).filter(Boolean).slice(0, 3);
    const payload = {
      bio: draft.bio,
      country: draft.country,
      city: draft.city,
      university: draft.university,
      work: draft.work,
      facts: normalizedFacts,
      interests: draft.interests,
      hobbies: draft.hobbies,
      avatar_url: draft.avatar_url || undefined,
    };

    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrors[`profile.${issue.path.join(".") || "root"}`] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    try {
      setSavingSection("profile");
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify(parsed.data) });
      await meQuery.refetch();
      markSaved("profile");
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ profile: e instanceof Error ? e.message : "Не удалось сохранить профиль" });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveNotifications() {
    const parsed = notificationsSchema.safeParse({
      notifications_likes: draft.notifications_likes,
      notifications_comments: draft.notifications_comments,
      notifications_events: draft.notifications_events,
      notifications_connections: draft.notifications_connections,
      notifications_digest: draft.notifications_digest,
      notifications_push: draft.notifications_push,
      notifications_email: draft.notifications_email,
    });

    if (!parsed.success) {
      setFieldErrors({ notifications: "Проверь настройки уведомлений" });
      return;
    }

    try {
      setSavingSection("notifications");
      await api("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          notification_settings: {
            likes: draft.notifications_likes,
            comments: draft.notifications_comments,
            events: draft.notifications_events,
            connections: draft.notifications_connections,
            weeklyDigest: draft.notifications_digest,
            push: draft.notifications_push,
            email: draft.notifications_email,
          },
        }),
      });
      await meQuery.refetch();
      markSaved("notifications");
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ notifications: e instanceof Error ? e.message : "Не удалось сохранить уведомления" });
    } finally {
      setSavingSection(null);
    }
  }

  async function savePreferences() {
    const parsed = preferencesSchema.safeParse({
      preferences_mode: draft.preferences_mode,
      preferences_intent: draft.preferences_intent,
      preferences_meetupFrequency: draft.preferences_meetupFrequency,
      preferences_lookingFor: draft.preferences_lookingFor,
    });

    if (!parsed.success) {
      setFieldErrors({ preferences: parsed.error.issues[0]?.message ?? "Проверь настройки знакомств" });
      return;
    }

    try {
      setSavingSection("networking");
      await api("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          preferences: {
            mode: draft.preferences_mode,
            intent: draft.preferences_intent,
            meetupFrequency: draft.preferences_meetupFrequency,
            lookingFor: draft.preferences_lookingFor,
          },
        }),
      });
      await meQuery.refetch();
      markSaved("networking");
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ preferences: e instanceof Error ? e.message : "Не удалось сохранить настройки знакомств" });
    } finally {
      setSavingSection(null);
    }
  }

  async function savePrivacy() {
    const parsed = privacySchema.safeParse(privacy);
    if (!parsed.success) {
      setFieldErrors({ privacy: parsed.error.issues[0]?.message ?? "Проверь приватность" });
      return;
    }

    try {
      setSavingSection("privacy");
      await api("/api/profile/privacy", { method: "PUT", body: JSON.stringify(parsed.data) });
      await privacyQuery.refetch();
      markSaved("privacy");
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ privacy: e instanceof Error ? e.message : "Не удалось сохранить приватность" });
    } finally {
      setSavingSection(null);
    }
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Можно загрузить только изображение");
      return;
    }

    try {
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append("avatar", file);
      const result = await api<{ url: string }>("/api/profile/avatar", { method: "POST", body: fd });
      setDraft((prev) => ({ ...prev, avatar_url: result.url }));
      markSaved("profile");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      const result = await api<{ success: boolean; signed_out: boolean }>("/api/profile/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
      await sessionsQuery.refetch();
      if (result.signed_out) {
        router.push("/login");
        return;
      }
      markSaved("devices");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессию");
    }
  }

  async function revokeAllSessions() {
    try {
      await api<{ success: boolean; revoked_count: number }>("/api/profile/sessions/revoke-all", {
        method: "POST",
        body: JSON.stringify({ except_current: true }),
      });
      await sessionsQuery.refetch();
      markSaved("devices");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессии");
    }
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

  const profile = meQuery.data?.profile;

  const completion = useMemo(() => {
    if (!profile) return 0;
    let c = 0;
    if (draft.avatar_url) c += 20;
    if (draft.bio) c += 15;
    if (draft.country && draft.city) c += 15;
    if (draft.university && draft.work) c += 20;
    if (draft.interests.length >= 3) c += 15;
    if (draft.facts.filter(Boolean).length >= 2) c += 15;
    return c;
  }, [profile, draft]);

  const activeSessions = sessionsQuery.data?.items ?? [];
  const currentSession = sessionsQuery.data?.current ?? null;
  const blockedUsers = privacyQuery.data?.blocked_users ?? [];

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text">Мой профиль</h1>
        <span className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-muted">Telegram-style settings</span>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="h-28 bg-[linear-gradient(120deg,rgba(7,15,38,0.98),rgba(82,204,131,0.25),rgba(96,170,255,0.35))]" />
        <CardContent className="-mt-12 p-4">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative rounded-3xl border-2 border-white/70 outline-none transition active:scale-[0.98]"
            >
              <Image
                src={draft.avatar_url || "https://placehold.co/320x320"}
                alt="avatar"
                width={160}
                height={160}
                unoptimized
                className="h-24 w-24 rounded-3xl object-cover"
              />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white">
                <Camera className="h-4 w-4" />
              </span>
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />

            <div className="pb-1">
              <p className="text-lg font-semibold text-text">{draft.name || "Пользователь"}</p>
              <p className="text-xs text-muted">{maskPhone(draft.phone)}</p>
              <p className="text-xs text-muted">{draft.city || "Город не указан"}</p>
              <p className="text-xs text-action">{uploadingAvatar ? "Загружаем фото..." : "Нажми на фото, чтобы изменить"}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-surface2/75 p-3">
            <p className="text-xs text-muted">Заполненность профиля</p>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <motion.div
                initial={false}
                animate={{ width: `${completion}%` }}
                className="h-2 rounded-full bg-[linear-gradient(90deg,#52CC83,#7ec4ff)]"
              />
            </div>
            <p className="mt-1 text-xs text-text">{completion}%</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/profile/${profile?.id ?? "me"}`} className="block">
              <Button variant="secondary" className="w-full">Посмотреть как видят другие</Button>
            </Link>
            <Button variant="secondary" className="w-full" onClick={() => setSection("profile")}>Редактировать</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <RowButton icon={<User className="h-4 w-4" />} title="Аккаунт" subtitle="Имя, email, телефон, удаление" onClick={() => setSection("account")} />
          <RowButton icon={<Sparkles className="h-4 w-4" />} title="Профиль" subtitle="Фото, bio, факты, интересы, город" onClick={() => setSection("profile")} />
          <RowButton icon={<Shield className="h-4 w-4" />} title="Конфиденциальность и безопасность" subtitle="Кто видит данные и кто может писать" onClick={() => setSection("privacy")} />
          <RowButton icon={<Monitor className="h-4 w-4" />} title="Устройства и активные сессии" subtitle="Текущее устройство и история входов" onClick={() => setSection("devices")} />
          <RowButton icon={<Bell className="h-4 w-4" />} title="Уведомления" subtitle="Коннекты, ответы, события и дайджест" onClick={() => setSection("notifications")} />
          <RowButton icon={<Users className="h-4 w-4" />} title="Настройки знакомств/нетворкинга" subtitle="Что ищу и как часто встречаюсь" onClick={() => setSection("networking")} />
          <RowButton icon={<Trophy className="h-4 w-4" />} title="Достижения" subtitle="Скоро: бейджи и уровень" onClick={() => setSection("achievements")} />
          <RowButton icon={<CircleHelp className="h-4 w-4" />} title="Помощь / О приложении" subtitle="Как работает профиль и приватность" onClick={() => setSection("about")} />

          <button
            type="button"
            onClick={logout}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-danger/50 bg-danger/10 text-sm font-medium text-danger transition active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </CardContent>
      </Card>

      <SettingsSheet
        open={section === "account"}
        onClose={() => setSection("none")}
        title="Аккаунт"
        subtitle="Базовые данные аккаунта и контроль доступа"
        right={savedSection === "account" ? <span className="text-xs text-action">Сохранено</span> : null}
      >
        <div className="rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Телефон</p>
          <p className="text-sm text-text">{maskPhone(draft.phone)}</p>
        </div>

        <div className="space-y-2">
          <Input
            value={draft.name}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, name: e.target.value }));
              clearError("account");
            }}
            placeholder="Имя"
          />

          {"username" in (profile ?? {}) ? (
            <Input
              value={draft.username}
              onChange={(e) => setDraft((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="Username"
            />
          ) : null}

          {"email" in (profile ?? {}) ? (
            <Input
              value={draft.email}
              onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              type="email"
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">Email не подключен для этого аккаунта</div>
          )}

          {fieldErrors.account ? <p className="text-xs text-danger">{fieldErrors.account}</p> : null}

          <Button className="w-full" onClick={saveAccount} disabled={savingSection === "account"}>
            {savingSection === "account" ? "Сохраняем..." : "Сохранить аккаунт"}
          </Button>

          <Button variant="danger" className="w-full" onClick={deleteAccount}>
            <Trash2 className="mr-2 h-4 w-4" /> Удалить аккаунт
          </Button>
        </div>
      </SettingsSheet>

      <SettingsSheet
        open={section === "profile"}
        onClose={() => setSection("none")}
        title="Профиль"
        subtitle="Эти данные влияют на качество рекомендаций"
        right={savedSection === "profile" ? <span className="text-xs text-action">Сохранено</span> : null}
      >
        <div className="rounded-xl border border-border bg-surface2/70 p-3 text-xs text-muted">
          Заполни 2-3 факта, интересы и рабочий контекст. Это повышает качество match-подбора.
        </div>

        <Textarea
          value={draft.bio}
          onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
          placeholder="Коротко о себе: кто ты и чем сейчас занимаешься"
        />

        <div className="grid grid-cols-2 gap-2">
          <Input value={draft.country} onChange={(e) => setDraft((prev) => ({ ...prev, country: e.target.value }))} placeholder="Страна" />
          <Input value={draft.city} onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))} placeholder="Город" />
        </div>

        <Input value={draft.university} onChange={(e) => setDraft((prev) => ({ ...prev, university: e.target.value }))} placeholder="ВУЗ" />
        <Input value={draft.work} onChange={(e) => setDraft((prev) => ({ ...prev, work: e.target.value }))} placeholder="Работа" />

        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Факты о себе (2–3)</p>
          {draft.facts.map((fact, idx) => (
            <Input
              key={`fact-${idx}`}
              value={fact}
              onChange={(e) => {
                const next = [...draft.facts];
                next[idx] = e.target.value;
                setDraft((prev) => ({ ...prev, facts: next }));
              }}
              placeholder={`Факт ${idx + 1}`}
            />
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Интересы (минимум 3)</p>
          <TagInput
            value={draft.interests}
            onChange={(v) => setDraft((prev) => ({ ...prev, interests: v }))}
            suggestions={popularTags}
            min={3}
            max={20}
            placeholder="Добавь интерес и нажми Enter"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Хобби (опционально)</p>
          <TagInput
            value={draft.hobbies}
            onChange={(v) => setDraft((prev) => ({ ...prev, hobbies: v }))}
            suggestions={popularTags}
            max={20}
            placeholder="Чем любишь заниматься в свободное время"
          />
        </div>

        {Object.entries(fieldErrors)
          .filter(([key]) => key.startsWith("profile") || key === "profile")
          .map(([key, message]) => (
            <p key={key} className="text-xs text-danger">{message}</p>
          ))}

        <Button className="w-full" onClick={saveProfile} disabled={savingSection === "profile"}>
          {savingSection === "profile" ? "Сохраняем..." : "Сохранить профиль"}
        </Button>
      </SettingsSheet>

      <SettingsSheet
        open={section === "privacy"}
        onClose={() => setSection("none")}
        title="Конфиденциальность и безопасность"
        subtitle="Управляй видимостью профиля как в Telegram"
        right={savedSection === "privacy" ? <span className="text-xs text-action">Сохранено</span> : null}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Кто видит</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
              <p className="text-xs text-muted">Телефон</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["nobody", "Никто"],
                  ["contacts", "Контакты"],
                  ["everyone", "Все"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrivacy((prev) => ({ ...prev, phone_visibility: value as PrivacySettings["phone_visibility"] }))}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      privacy.phone_visibility === value ? "border-action bg-action/20 text-action" : "border-border bg-black/10 text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <SwitchRow label="Факты" hint={boolLabel(privacy.show_facts)} checked={privacy.show_facts} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_facts: v }))} />
            <SwitchRow label="Интересы" hint={boolLabel(privacy.show_interests)} checked={privacy.show_interests} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_interests: v }))} />
            <SwitchRow label="История мероприятий" hint={boolLabel(privacy.show_event_history)} checked={privacy.show_event_history} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_event_history: v }))} />
            <SwitchRow label="Город" hint={boolLabel(privacy.show_city)} checked={privacy.show_city} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_city: v }))} />
            <SwitchRow label="Работа" hint={boolLabel(privacy.show_work)} checked={privacy.show_work} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_work: v }))} />
            <SwitchRow label="ВУЗ" hint={boolLabel(privacy.show_university)} checked={privacy.show_university} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_university: v }))} />
            <SwitchRow label="Последняя активность" hint={privacy.show_last_active ? "Показывать 'был недавно'" : "Скрыто"} checked={privacy.show_last_active} onChange={(v) => setPrivacy((prev) => ({ ...prev, show_last_active: v }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Кто может писать</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={privacy.who_can_message}
              onChange={(e) => setPrivacy((prev) => ({ ...prev, who_can_message: e.target.value as PrivacySettings["who_can_message"] }))}
              className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
            >
              <option value="everyone">Все</option>
              <option value="shared_events">Только участники общих событий</option>
              <option value="connections">Только контакты</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Блокировки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {blockedUsers.length ? (
              blockedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-surface2/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src={u.avatar_url || "https://placehold.co/80x80"}
                      alt={u.name || "user"}
                      width={40}
                      height={40}
                      className="h-9 w-9 rounded-full object-cover"
                      unoptimized
                    />
                    <p className="text-sm text-text">{u.name || "Пользователь"}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPrivacy((prev) => ({
                        ...prev,
                        blocked_user_ids: prev.blocked_user_ids.filter((id) => id !== u.id),
                      }))
                    }
                  >
                    Разблокировать
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">Список блокировок пуст</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Безопасность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={revokeAllSessions}>
              <Lock className="mr-2 h-4 w-4" /> Выйти со всех устройств
            </Button>
            <Link href="/login" className="block">
              <Button variant="secondary" className="w-full">
                Сменить пароль / метод входа
              </Button>
            </Link>
          </CardContent>
        </Card>

        {fieldErrors.privacy ? <p className="text-xs text-danger">{fieldErrors.privacy}</p> : null}

        <Button className="w-full" onClick={savePrivacy} disabled={savingSection === "privacy"}>
          {savingSection === "privacy" ? "Сохраняем..." : "Сохранить приватность"}
        </Button>
      </SettingsSheet>

      <SettingsSheet
        open={section === "devices"}
        onClose={() => setSection("none")}
        title="Устройства и активные сессии"
        subtitle="Контролируй, где открыт аккаунт"
        right={savedSection === "devices" ? <span className="text-xs text-action">Обновлено</span> : null}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Текущее устройство</CardTitle>
          </CardHeader>
          <CardContent>
            {currentSession ? (
              <div className="rounded-xl border border-action/30 bg-action/10 p-3">
                <p className="text-sm text-text">{currentSession.device_label}</p>
                <p className="text-xs text-muted">Активность: {new Date(currentSession.last_active_at).toLocaleString("ru-RU")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted">Текущая сессия не найдена</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Активные сессии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.length ? (
              activeSessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-text">{s.device_label}</p>
                      <p className="text-xs text-muted">{s.approx_location || "Локация недоступна"}</p>
                      <p className="text-xs text-muted">Был(а) активен(а): {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
                    </div>
                    {s.is_current ? (
                      <span className="rounded-full border border-action/30 bg-action/10 px-2 py-1 text-[10px] text-action">Текущее</span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => revokeSession(s.id)}>
                        Завершить
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">Сессий нет</p>
            )}
          </CardContent>
        </Card>

        <Button variant="secondary" className="w-full" onClick={revokeAllSessions}>
          Завершить все кроме текущей
        </Button>
      </SettingsSheet>

      <SettingsSheet
        open={section === "notifications"}
        onClose={() => setSection("none")}
        title="Уведомления"
        subtitle="Только важные сигналы: коннекты, ответы, ивенты"
        right={savedSection === "notifications" ? <span className="text-xs text-action">Сохранено</span> : null}
      >
        <SwitchRow label="Лайки" hint="Реакции на твой контент" checked={draft.notifications_likes} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_likes: v }))} />
        <SwitchRow label="Комментарии" hint="Новые комментарии" checked={draft.notifications_comments} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_comments: v }))} />
        <SwitchRow label="События" hint="Напоминания и updates по ивентам" checked={draft.notifications_events} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_events: v }))} />
        <SwitchRow label="Коннекты" hint="Запросы и ответы на знакомство" checked={draft.notifications_connections} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_connections: v }))} />
        <SwitchRow label="Недельный дайджест" hint="Краткий weekly отчёт" checked={draft.notifications_digest} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_digest: v }))} />
        <SwitchRow label="Push" hint="Уведомления в браузере/приложении" checked={draft.notifications_push} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_push: v }))} />
        <SwitchRow label="Email" hint="Дублировать важные уведомления в почту" checked={draft.notifications_email} onChange={(v) => setDraft((prev) => ({ ...prev, notifications_email: v }))} />

        {fieldErrors.notifications ? <p className="text-xs text-danger">{fieldErrors.notifications}</p> : null}

        <Button className="w-full" onClick={saveNotifications} disabled={savingSection === "notifications"}>
          {savingSection === "notifications" ? "Сохраняем..." : "Сохранить уведомления"}
        </Button>
      </SettingsSheet>

      <SettingsSheet
        open={section === "networking"}
        onClose={() => setSection("none")}
        title="Настройки знакомств/нетворкинга"
        subtitle="Эти параметры использует подбор и AI-подсказки"
        right={savedSection === "networking" ? <span className="text-xs text-action">Сохранено</span> : null}
      >
        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Режим</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["dating", "Знакомства"],
              ["networking", "Нетворк"],
              ["both", "Оба"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, preferences_mode: value as Draft["preferences_mode"] }))}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  draft.preferences_mode === value ? "border-action bg-action/20 text-action" : "border-border bg-black/10 text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Input
          value={draft.preferences_intent}
          onChange={(e) => setDraft((prev) => ({ ...prev, preferences_intent: e.target.value }))}
          placeholder="Цель (пример: найти кофаундера в fintech)"
        />

        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Что ищу</p>
          <TagInput
            value={draft.preferences_lookingFor}
            onChange={(v) => setDraft((prev) => ({ ...prev, preferences_lookingFor: v }))}
            suggestions={["друзья", "нетворк", "отношения", "ивенты", "кофаундер", "ментор", "партнер"]}
            min={1}
            max={6}
            placeholder="Добавь цель и Enter"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
          <p className="text-xs text-muted">Частота встреч</p>
          <select
            value={draft.preferences_meetupFrequency}
            onChange={(e) => setDraft((prev) => ({ ...prev, preferences_meetupFrequency: e.target.value as Draft["preferences_meetupFrequency"] }))}
            className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
          >
            <option value="low">Редко</option>
            <option value="medium">Средне</option>
            <option value="high">Часто</option>
          </select>
        </div>

        {fieldErrors.preferences ? <p className="text-xs text-danger">{fieldErrors.preferences}</p> : null}

        <Button className="w-full" onClick={savePreferences} disabled={savingSection === "networking"}>
          {savingSection === "networking" ? "Сохраняем..." : "Сохранить настройки"}
        </Button>
      </SettingsSheet>

      <SettingsSheet
        open={section === "achievements"}
        onClose={() => setSection("none")}
        title="Достижения"
        subtitle="Раздел готовится"
      >
        <div className="rounded-2xl border border-border bg-surface2/70 p-4 text-sm text-muted">
          Центр достижений будет добавлен отдельным релизом. Здесь появятся бейджи, сезонные достижения и закреплённый значок в публичном профиле.
        </div>
      </SettingsSheet>

      <SettingsSheet
        open={section === "about"}
        onClose={() => setSection("none")}
        title="Помощь / О приложении"
        subtitle="Как использовать профиль и настройки"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Как пользоваться</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            <p>1. Заполни профиль: фото, 2–3 факта, интересы, ВУЗ и работу.</p>
            <p>2. Настрой приватность: что видят другие и кто может писать.</p>
            <p>3. Проверь устройства и заверши лишние сессии.</p>
            <p>4. Открой публичный preview и проверь, как тебя видят другие.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">О продукте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted">
            <p>Meetap — соцсеть для офлайн-знакомств и нетворкинга.</p>
            <p>Контакты поддержки: support@meetap.app</p>
            <p>Версия: MVP beta</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => router.push("/profile/psych-test")}>Психотест</Button>
          <Link href="/feed" className="block">
            <Button variant="secondary" className="w-full">В ленту</Button>
          </Link>
        </div>
      </SettingsSheet>

      {meQuery.isLoading ? (
        <Card className="mt-3">
          <CardContent className="p-4 text-sm text-muted">Загрузка профиля...</CardContent>
        </Card>
      ) : null}

      {meQuery.error ? (
        <Card className="mt-3 border-danger/30">
          <CardContent className="p-4 text-sm text-danger">Не удалось загрузить профиль</CardContent>
        </Card>
      ) : null}

      <div className="h-10" />
    </PageShell>
  );
}
