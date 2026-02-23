"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon, Sun, ChevronRight, UserRound, GraduationCap, BriefcaseBusiness, Sparkles } from "lucide-react";
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
    if (t === "dark") document.documentElement.classList.add("dark");
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
      toast.success("Профиль обновлен");
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

  const name = data?.profile?.name ?? "Пользователь";
  const phone = data?.profile?.phone ?? "Номер не указан";
  const level = data?.profile?.level ?? 1;
  const xp = data?.profile?.xp ?? 0;

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="mb-3 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[#1f4ed8]/40 to-[#0f766e]/40" />
        <CardContent className="-mt-8 space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Image
              src={form.avatar_url || "https://placehold.co/120"}
              alt={name}
              width={120}
              height={120}
              className="h-16 w-16 rounded-full border-2 border-[#0b0f2c] object-cover"
              unoptimized
            />
            <div>
              <p className="text-lg font-semibold">{name}</p>
              <p className="text-sm text-muted">{phone}</p>
              <p className="text-xs text-muted">Level {level} · XP {xp}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-black/10 p-3 text-sm text-muted">
            Личный профиль как в мессенджере: коротко, чисто, легко читать и редактировать.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="p-2">
          <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/5">
            <span className="flex items-center gap-2 text-sm"><UserRound className="h-4 w-4" /> Аккаунт и приватность</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/5">
            <span className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4" /> Настроить рекомендации</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted">Заполни профиль, чтобы людям проще было знакомиться с тобой.</p>

          <Input
            placeholder="Ссылка на фото профиля"
            value={form.avatar_url}
            onChange={(e) => setForm((s) => ({ ...s, avatar_url: e.target.value }))}
          />

          <label className="text-xs text-muted">Учеба и работа</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input className="pl-9" placeholder="ВУЗ" value={form.university} onChange={(e) => setForm((s) => ({ ...s, university: e.target.value }))} />
            </div>
            <div className="relative">
              <BriefcaseBusiness className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input className="pl-9" placeholder="Работа" value={form.work} onChange={(e) => setForm((s) => ({ ...s, work: e.target.value }))} />
            </div>
          </div>

          <Input
            placeholder="Хобби через запятую (бег, кино, кофе)"
            value={form.hobbies}
            onChange={(e) => setForm((s) => ({ ...s, hobbies: e.target.value }))}
          />
          <Textarea
            placeholder="Интересы (минимум 3): стартапы, дизайн, музыка"
            value={form.interests}
            onChange={(e) => setForm((s) => ({ ...s, interests: e.target.value }))}
          />
          <Textarea
            placeholder={"3 факта о себе (каждый с новой строки)\nНапример:\nЛюблю пешие прогулки\nВеду канал про музыку\nХочу больше офлайн-знакомств"}
            value={form.facts}
            onChange={(e) => setForm((s) => ({ ...s, facts: e.target.value }))}
          />

          <Button className="w-full" onClick={save}>Сохранить</Button>
          <Button variant="secondary" className="w-full" onClick={logout}>Выйти</Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
