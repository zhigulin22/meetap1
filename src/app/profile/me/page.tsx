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
import { Brain, Camera, Moon, Sun, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";

const profileSchema = z.object({
  name: z.string().min(2).max(50),
  country: z.string().max(80).optional(),
  bio: z.string().max(350).optional(),
  university: z.string().max(120).optional(),
  work: z.string().max(120).optional(),
  hobbies: z.string().optional(),
  interests: z.string().refine((v) => v.split(",").map((x) => x.trim()).filter(Boolean).length >= 3, "Минимум 3 интереса"),
  facts: z.string().refine((v) => v.split("\n").map((x) => x.trim()).filter(Boolean).length >= 3, "Нужно 3 факта"),
  intent: z.string().max(120).optional(),
  mode: z.enum(["dating", "networking", "both"]),
  meetupFrequency: z.enum(["low", "medium", "high"]),
  profileVisibility: z.enum(["public", "members", "connections"]),
  allowMessagesFrom: z.enum(["everyone", "verified", "connections"]),
  showPhone: z.boolean(),
  hideLastSeen: z.boolean(),
  blockedUsers: z.string().optional(),
  notifyLikes: z.boolean(),
  notifyComments: z.boolean(),
  notifyEvents: z.boolean(),
  notifyConnections: z.boolean(),
  notifyModeration: z.boolean(),
  notifyDigest: z.boolean(),
});

type FormValues = z.infer<typeof profileSchema>;

export default function MyProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tab, setTab] = useState("profile");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ profile: any; activity: { posts: number; eventJoins: number; connections: number; reactions: number } }>("/api/profile/me"),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () =>
      api<{
        items: Array<{ id: string; device_label: string; created_at: string; last_active_at: string; revoked_at: string | null }>;
      }>("/api/auth/sessions"),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      country: "",
      bio: "",
      university: "",
      work: "",
      hobbies: "",
      interests: "",
      facts: "",
      intent: "",
      mode: "both",
      meetupFrequency: "medium",
      profileVisibility: "members",
      allowMessagesFrom: "verified",
      showPhone: false,
      hideLastSeen: false,
      blockedUsers: "",
      notifyLikes: true,
      notifyComments: true,
      notifyEvents: true,
      notifyConnections: true,
      notifyModeration: true,
      notifyDigest: true,
    },
  });

  useEffect(() => {
    const t = (localStorage.getItem("theme") as "dark" | "light" | null) ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;

    setAvatarUrl(p.avatar_url ?? "");

    form.reset({
      name: p.name ?? "",
      country: p.country ?? "",
      bio: p.bio ?? "",
      university: p.university ?? "",
      work: p.work ?? "",
      hobbies: (p.hobbies ?? []).join(", "),
      interests: (p.interests ?? []).join(", "),
      facts: (p.facts ?? []).join("\n"),
      intent: p.preferences?.intent ?? "",
      mode: p.preferences?.mode ?? "both",
      meetupFrequency: p.preferences?.meetupFrequency ?? "medium",
      profileVisibility: p.privacy_settings?.profileVisibility ?? "members",
      allowMessagesFrom: p.privacy_settings?.allowMessagesFrom ?? "verified",
      showPhone: p.privacy_settings?.showPhone ?? false,
      hideLastSeen: p.privacy_settings?.hideLastSeen ?? false,
      blockedUsers: (p.privacy_settings?.blockedUsers ?? []).join("\n"),
      notifyLikes: p.notification_settings?.likes ?? true,
      notifyComments: p.notification_settings?.comments ?? true,
      notifyEvents: p.notification_settings?.events ?? true,
      notifyConnections: p.notification_settings?.connections ?? true,
      notifyModeration: p.notification_settings?.moderation ?? true,
      notifyDigest: p.notification_settings?.weeklyDigest ?? true,
    });
  }, [data, form]);

  async function uploadAvatar(file: File) {
    try {
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api<{ url: string }>("/api/profile/avatar", { method: "POST", body: fd });
      setAvatarUrl(res.url);
      toast.success("Фото обновлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save(values: FormValues) {
    try {
      const interests = (values.interests ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const facts = (values.facts ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3);
      const hobbies = (values.hobbies ?? "").split(",").map((x) => x.trim()).filter(Boolean);

      await api("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          country: values.country,
          bio: values.bio,
          university: values.university,
          work: values.work,
          hobbies,
          interests,
          facts,
          avatar_url: avatarUrl || undefined,
          preferences: {
            mode: values.mode,
            intent: values.intent,
            meetupFrequency: values.meetupFrequency,
          },
          privacy_settings: {
            profileVisibility: values.profileVisibility,
            allowMessagesFrom: values.allowMessagesFrom,
            showPhone: values.showPhone,
            hideLastSeen: values.hideLastSeen,
            blockedUsers: (values.blockedUsers ?? "")
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          },
          notification_settings: {
            likes: values.notifyLikes,
            comments: values.notifyComments,
            events: values.notifyEvents,
            connections: values.notifyConnections,
            moderation: values.notifyModeration,
            weeklyDigest: values.notifyDigest,
          },
        }),
      });

      await refetch();
      toast.success("Профиль сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
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

  async function deleteAccount() {
    if (!confirm("Удалить аккаунт? Действие необратимо.")) return;
    await api("/api/profile/account", { method: "DELETE" });
    router.push("/register");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  const profile = data?.profile;

  const completionScore = useMemo(() => {
    const p = data?.profile;
    if (!p) return 0;
    let score = 0;
    if (p.avatar_url) score += 20;
    if (p.bio) score += 20;
    if ((p.interests ?? []).length >= 3) score += 20;
    if ((p.facts ?? []).length >= 3) score += 20;
    if (p.country) score += 20;
    return score;
  }, [data]);

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profile Control</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(9,20,46,0.95),rgba(82,204,131,0.35),rgba(69,120,223,0.5))]" />
        <CardContent className="-mt-10 p-4">
          <div className="flex items-end gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative">
              <Image
                src={avatarUrl || "https://placehold.co/120"}
                alt="avatar"
                width={120}
                height={120}
                className="h-20 w-20 rounded-3xl border-2 border-white/70 object-cover"
                unoptimized
              />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-white/25 bg-black/60 p-1.5">
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
            <div>
              <p className="text-lg font-semibold">{profile?.name ?? "Пользователь"}</p>
              <p className="text-xs text-muted">{profile?.phone}</p>
              <p className="text-xs text-muted">Level {profile?.level ?? 1} · XP {profile?.xp ?? 0}</p>
              <p className="text-xs text-action">{uploadingAvatar ? "Загрузка фото..." : "Нажми на фото, чтобы обновить"}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-black/10 p-2">
            <p className="text-xs text-muted">Profile completeness</p>
            <div className="mt-1 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-[linear-gradient(90deg,#52cc83,#6ec6ff)]" style={{ width: `${completionScore}%` }} />
            </div>
            <p className="mt-1 text-xs">{completionScore}%</p>
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

      <form onSubmit={form.handleSubmit(save)} className="space-y-3">
        <Tabs value={tab} onValueChange={setTab} className="space-y-3">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="prefs">Preferences</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notify">Notifications</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Имя" {...form.register("name")} />
                <Input placeholder="Страна" {...form.register("country")} />
                <Textarea placeholder="Короткое био" {...form.register("bio")} />
                <Input placeholder="Университет" {...form.register("university")} />
                <Input placeholder="Работа" {...form.register("work")} />
                <Input placeholder="Хобби (через запятую)" {...form.register("hobbies")} />
                <Textarea placeholder="Интересы (минимум 3, через запятую). Это важно для точного подбора людей" {...form.register("interests")} />
                <Textarea placeholder="3 факта о себе (каждый с новой строки). Это повышает ответы на первые сообщения" {...form.register("facts")} />
                {form.formState.errors.interests ? <p className="text-xs text-danger">{form.formState.errors.interests.message}</p> : null}
                {form.formState.errors.facts ? <p className="text-xs text-danger">{form.formState.errors.facts.message}</p> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prefs">
            <Card>
              <CardHeader><CardTitle>Dating / Networking Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Что ищешь сейчас" {...form.register("intent")} />
                <select {...form.register("mode")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
                  <option value="both">Dating + Networking</option>
                  <option value="dating">Dating</option>
                  <option value="networking">Networking</option>
                </select>
                <select {...form.register("meetupFrequency")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
                  <option value="low">Редко</option>
                  <option value="medium">Средне</option>
                  <option value="high">Часто</option>
                </select>
                <p className="text-xs text-muted">Эти настройки напрямую влияют на релевантность рекомендаций людей и ивентов.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardHeader><CardTitle>Privacy & Safety</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("showPhone")} /> Показать телефон</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("hideLastSeen")} /> Скрыть последний визит</label>
                <select {...form.register("profileVisibility")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
                  <option value="public">Публичный</option>
                  <option value="members">Только участники</option>
                  <option value="connections">Только connections</option>
                </select>
                <select {...form.register("allowMessagesFrom")} className="h-11 w-full rounded-xl border border-border bg-surface2/85 px-3 text-sm">
                  <option value="everyone">Сообщения от всех</option>
                  <option value="verified">Только verified</option>
                  <option value="connections">Только connections</option>
                </select>
                <Textarea placeholder="Block list (uuid по одному в строке)" {...form.register("blockedUsers")} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-black/10 p-3 text-sm"><p className="text-xs text-muted">Posts</p><p className="text-xl font-semibold">{data?.activity.posts ?? 0}</p></div>
                <div className="rounded-xl border border-border bg-black/10 p-3 text-sm"><p className="text-xs text-muted">Event joins</p><p className="text-xl font-semibold">{data?.activity.eventJoins ?? 0}</p></div>
                <div className="rounded-xl border border-border bg-black/10 p-3 text-sm"><p className="text-xs text-muted">Connections</p><p className="text-xl font-semibold">{data?.activity.connections ?? 0}</p></div>
                <div className="rounded-xl border border-border bg-black/10 p-3 text-sm"><p className="text-xs text-muted">Reactions</p><p className="text-xl font-semibold">{data?.activity.reactions ?? 0}</p></div>
                <Link href="/feed" className="col-span-2"><Button variant="secondary" className="w-full">Открыть ленту</Button></Link>
                <Link href="/events" className="col-span-2"><Button variant="secondary" className="w-full">Открыть мероприятия</Button></Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notify">
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyLikes")} /> Лайки</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyComments")} /> Комментарии</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyEvents")} /> Ивенты</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyConnections")} /> Коннекты</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyModeration")} /> Безопасность</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...form.register("notifyDigest")} /> Weekly digest</label>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader><CardTitle>Account</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-xl border border-border bg-black/10 p-3 text-xs">
                  {(sessionsQuery.data?.items ?? []).map((s) => (
                    <p key={s.id}>{s.device_label} · {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
                  ))}
                </div>
                <Button variant="secondary" type="button" onClick={revokeAllSessions} className="w-full">Закрыть все сессии</Button>
                <Button variant="secondary" type="button" onClick={logout} className="w-full">Выйти</Button>
                <Button variant="danger" type="button" onClick={deleteAccount} className="w-full"><Trash2 className="mr-1 h-4 w-4" />Удалить аккаунт</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" className="w-full">Сохранить изменения</Button>
      </form>

      <div className="mt-3">
        <Link href="/profile/psych-test" className="block">
          <Button variant="secondary" className="w-full"><Brain className="mr-1 h-4 w-4" />Психотест</Button>
        </Link>
      </div>
    </PageShell>
  );
}
