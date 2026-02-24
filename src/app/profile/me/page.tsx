"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon, Sun, UserRound, BriefcaseBusiness, GraduationCap, Sparkles, Brain } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

const PSYCH_QUESTIONS = [
  { id: "new", label: "Мне нравится пробовать новое" },
  { id: "culture", label: "Мне интересны культура и творчество" },
  { id: "ideas", label: "Люблю обсуждать идеи и смыслы" },
  { id: "people", label: "Легко знакомлюсь с новыми людьми" },
  { id: "group", label: "Комфортно быть в центре группы" },
  { id: "energy", label: "Меня заряжают живые мероприятия" },
  { id: "listen", label: "Я внимательный слушатель" },
  { id: "meaning", label: "Предпочитаю глубокие разговоры" },
  { id: "care", label: "Чувствую настроение собеседника" },
  { id: "fast", label: "Быстро перехожу от идеи к действию" },
  { id: "plan", label: "Мне важна структура и план" },
  { id: "initiative", label: "Чаще сам(а) предлагаю встречу" },
] as const;

type PsychProfile = {
  style: string;
  openness: number;
  sociability: number;
  depth: number;
  pace: number;
  recommendations: string[];
};

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

  const [testOpen, setTestOpen] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, number>>(
    Object.fromEntries(PSYCH_QUESTIONS.map((q) => [q.id, 3])),
  );
  const [savingTest, setSavingTest] = useState(false);

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

  const psychProfile = useMemo(() => (data?.profile?.personality_profile ?? null) as PsychProfile | null, [data]);

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

  async function runPsychTest() {
    setSavingTest(true);
    try {
      const answers = PSYCH_QUESTIONS.map((q) => ({ id: q.id, value: Number(testValues[q.id] ?? 3) }));
      await api("/api/profile/psych-test", {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setTestOpen(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка теста");
    } finally {
      setSavingTest(false);
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

      <Card className="mb-3 overflow-hidden border-white/15">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(8,14,47,0.95),rgba(82,204,131,0.35),rgba(73,111,236,0.55))]" />
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

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setTestOpen(true)}>
              <Brain className="mr-1 h-4 w-4" />
              Психотест
            </Button>
            <Button variant="secondary" onClick={logout}>Выйти</Button>
          </div>
        </CardContent>
      </Card>

      {psychProfile ? (
        <Card className="mb-3 border-white/15">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">Психопрофиль: {psychProfile.style}</p>
            <p className="text-xs text-muted">Open {psychProfile.openness}% · Social {psychProfile.sociability}% · Depth {psychProfile.depth}% · Pace {psychProfile.pace}%</p>
            {psychProfile.recommendations?.map((x) => (
              <p key={x} className="text-xs text-muted">• {x}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-3 border-white/15">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Фото профиля</label>
            <Input value={form.avatar_url} onChange={(e) => setForm((s) => ({ ...s, avatar_url: e.target.value }))} placeholder="https://..." />
          </div>

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

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogHeader>
          <DialogTitle>Психотест для точного мэтчинга</DialogTitle>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
          {PSYCH_QUESTIONS.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-black/10 p-3">
              <p className="mb-2 text-sm">{q.label}</p>
              <input
                type="range"
                min={1}
                max={5}
                value={testValues[q.id] ?? 3}
                onChange={(e) => setTestValues((s) => ({ ...s, [q.id]: Number(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-muted">Оценка: {testValues[q.id] ?? 3}/5</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setTestOpen(false)}>
            Отмена
          </Button>
          <Button className="flex-1" onClick={runPsychTest} disabled={savingTest}>
            {savingTest ? "..." : "Сохранить тест"}
          </Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
