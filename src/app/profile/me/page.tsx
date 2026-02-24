"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon, Sun, UserRound, BriefcaseBusiness, GraduationCap, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export default function MyProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
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
      toast.success("Профиль обновлён");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/register");
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
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="mb-3 overflow-hidden border-white/15 bg-surface/90 backdrop-blur-xl">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(12,20,68,0.95),rgba(82,204,131,0.35),rgba(90,125,255,0.5))]" />
        <CardContent className="-mt-10 p-4">
          <div className="flex items-end gap-3">
            <Image
              src={form.avatar_url || "https://placehold.co/120"}
              alt={profile?.name ?? "avatar"}
              width={120}
              height={120}
              className="h-20 w-20 rounded-2xl border-2 border-white/70 object-cover shadow-xl"
              unoptimized
            />
            <div className="pb-1">
              <p className="text-lg font-semibold">{profile?.name ?? "Пользователь"}</p>
              <p className="text-xs text-muted">{profile?.phone ?? "Номер не указан"}</p>
              <p className="text-xs text-muted">Level {profile?.level ?? 1} · XP {profile?.xp ?? 0}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-black/15 p-3 text-sm text-muted">
            Профиль в стиле мессенджера: кратко, чисто, удобно для частого использования.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3 border-white/15 bg-surface/90 backdrop-blur-xl">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Фото профиля</label>
            <Input
              value={form.avatar_url}
              onChange={(e) => setForm((s) => ({ ...s, avatar_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted"><GraduationCap className="h-3.5 w-3.5" /> ВУЗ</label>
              <Input
                value={form.university}
                onChange={(e) => setForm((s) => ({ ...s, university: e.target.value }))}
                placeholder="Университет"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-muted"><BriefcaseBusiness className="h-3.5 w-3.5" /> Работа</label>
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
            <label className="flex items-center gap-1 text-xs text-muted"><Sparkles className="h-3.5 w-3.5" /> Интересы (минимум 3)</label>
            <Textarea
              value={form.interests}
              onChange={(e) => setForm((s) => ({ ...s, interests: e.target.value }))}
              placeholder="дизайн, маркетинг, музыка"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs text-muted"><UserRound className="h-3.5 w-3.5" /> 3 факта о себе</label>
            <Textarea
              value={form.facts}
              onChange={(e) => setForm((s) => ({ ...s, facts: e.target.value }))}
              placeholder={"Люблю офлайн встречи\nХожу на концерты\nРазвиваю pet-проекты"}
            />
          </div>

          <Button className="w-full" onClick={save}>Сохранить профиль</Button>
          <Button variant="secondary" className="w-full" onClick={logout}>Выйти</Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
