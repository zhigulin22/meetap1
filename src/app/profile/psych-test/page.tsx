"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Brain, ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

type Trait = "openness" | "conscientiousness" | "extraversion" | "agreeableness" | "neuroticism";

type Question = {
  id: string;
  trait: Trait;
  reverse?: boolean;
  text: string;
  group: string;
};

const QUESTIONS: Question[] = [
  { id: "q1", trait: "extraversion", text: "Мне проще знакомиться в живой обстановке (ивенты, прогулки)", group: "Социальный стиль" },
  { id: "q2", trait: "extraversion", reverse: true, text: "Мне легче сначала переписаться, чем сразу идти в офлайн", group: "Социальный стиль" },
  { id: "q3", trait: "openness", text: "Мне интересно пробовать нестандартные форматы знакомств", group: "Социальный стиль" },
  { id: "q4", trait: "agreeableness", text: "Мне важно быть тактичным и учитывать эмоции другого", group: "Коммуникация" },
  { id: "q5", trait: "agreeableness", reverse: true, text: "В споре я чаще давлю, чтобы быть убедительным", group: "Коммуникация" },
  { id: "q6", trait: "openness", text: "Мне интересно обсуждать смыслы, ценности, идеи", group: "Коммуникация" },
  { id: "q7", trait: "conscientiousness", text: "Мне важна пунктуальность и выполнение договорённостей", group: "Темп" },
  { id: "q8", trait: "conscientiousness", reverse: true, text: "Я легко меняю планы и часто импровизирую", group: "Темп" },
  { id: "q9", trait: "extraversion", text: "Я быстро включаюсь в диалог и люблю активное общение", group: "Темп" },
  { id: "q10", trait: "neuroticism", text: "Я могу переживать из-за неопределённости", group: "Баланс" },
  { id: "q11", trait: "neuroticism", reverse: true, text: "В стрессовых ситуациях я сохраняю спокойствие", group: "Баланс" },
  { id: "q12", trait: "agreeableness", text: "Мне важно строить контакт через доверие и уважение", group: "Баланс" },
];

const OPTIONS = [
  { value: 1, label: "Совсем не про меня" },
  { value: 2, label: "Скорее нет" },
  { value: 3, label: "Частично" },
  { value: 4, label: "Скорее да" },
  { value: 5, label: "Очень похоже" },
];

const PER_STEP = 2;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function scoreTrait(answers: Record<string, number>, trait: Trait) {
  const items = QUESTIONS.filter((q) => q.trait === trait);
  if (!items.length) return 0;
  const sum = items.reduce((acc, q) => {
    const val = answers[q.id] ?? 0;
    const normalized = q.reverse ? 6 - val : val;
    return acc + normalized;
  }, 0);
  return Math.round((sum / (items.length * 5)) * 100);
}

export default function PsychTestPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [openAnswers, setOpenAnswers] = useState({ social_goal: "", deal_breakers: "", conversation_topics: "" });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setAgreed(params.get("agree") === "1");
  }, []);

  const chunks = useMemo(() => chunk(QUESTIONS, PER_STEP), []);
  const totalSteps = chunks.length + 1;
  const progress = Math.round(((step + 1) / totalSteps) * 100);
  const currentChunk = chunks[step] ?? null;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const ready = answeredCount >= QUESTIONS.length;
  const canGoNext = currentChunk ? currentChunk.every((q) => Boolean(answers[q.id])) : true;
  const stepLabel = `Шаг ${Math.min(step + 1, totalSteps)} из ${totalSteps}`;

  async function submit() {
    if (!ready) {
      toast.error("Ответь на все вопросы теста");
      return;
    }

    try {
      setLoading(true);
      await api("/api/profile/psych-test", {
        method: "POST",
        body: JSON.stringify({
          answers: QUESTIONS.map((q) => ({
            id: q.id,
            trait: q.trait,
            reverse: Boolean(q.reverse),
            value: answers[q.id],
          })),
          openAnswers,
        }),
      });

      localStorage.removeItem("meetap_psych_reminder_until");
      setSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения теста");
    } finally {
      setLoading(false);
    }
  }

  if (!agreed) {
    return (
      <PageShell>
        <Card>
          <CardContent className="space-y-3 p-4">
            <h1 className="font-display text-lg font-semibold text-text">Перед тестом нужно пройти интро</h1>
            <p className="text-sm text-muted">Открой страницу психотеста из настроек профиля, прочитай зачем он нужен и подтверди согласие.</p>
            <Link href="/profile/me/psych-test" className="block">
              <Button className="w-full">Перейти к интро</Button>
            </Link>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (saved) {
    const summary = [
      { label: "Открытость", value: scoreTrait(answers, "openness") },
      { label: "Надёжность", value: scoreTrait(answers, "conscientiousness") },
      { label: "Социальная энергия", value: scoreTrait(answers, "extraversion") },
      { label: "Эмпатия", value: scoreTrait(answers, "agreeableness") },
      { label: "Стресс-устойчивость", value: 100 - scoreTrait(answers, "neuroticism") },
    ];

    return (
      <PageShell>
        <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)]">
          <CardContent className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[rgb(var(--teal-rgb))]" />
            <h1 className="text-2xl font-semibold">Психопрофиль обновлён</h1>
            <p className="text-sm text-text2">Мы используем ответы для рекомендаций и совместимости.</p>
            <div className="grid gap-2 text-left">
              {summary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.75)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text2">{item.label}</span>
                    <span className="font-semibold text-text">{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[rgb(var(--surface-3-rgb)/0.6)]">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))]" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => router.push("/profile/me")}>В профиль</Button>
              <Button variant="secondary" onClick={() => router.push("/contacts")}>К людям</Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <Card className="overflow-hidden border-borderStrong">
          <div className="h-28 bg-[radial-gradient(circle_at_20%_20%,rgb(var(--violet-rgb)/0.32),transparent_45%),radial-gradient(circle_at_80%_20%,rgb(var(--sky-rgb)/0.45),transparent_45%),linear-gradient(130deg,rgb(var(--surface-2-rgb)),rgb(var(--surface-3-rgb)))]" />
          <CardContent className="-mt-8 space-y-2 p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-border bg-[rgb(var(--surface-1-rgb)/0.6)] p-2"><Brain className="h-5 w-5" /></div>
              <h1 className="text-xl font-semibold">Психологический профиль</h1>
            </div>
            <p className="text-sm text-muted">По 2 вопроса за шаг, без перегруза.</p>
            <div className="mt-2 h-2 w-full rounded-full bg-[rgb(var(--surface-3-rgb)/0.6)]">
              <div className="h-2 rounded-full bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{stepLabel}</span>
              <span>Заполнено: {answeredCount}/{QUESTIONS.length}</span>
            </div>
          </CardContent>
        </Card>

        {currentChunk ? (
          <Card className="border-border">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold text-text">{currentChunk[0]?.group}</p>
                <p className="text-xs text-text2">Ответь честно — это улучшит рекомендации</p>
              </div>
              <div className="space-y-3">
                {currentChunk.map((q) => (
                  <div key={q.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-3">
                    <p className="text-sm font-medium">{q.text}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {OPTIONS.map((option) => {
                        const active = answers[q.id] === option.value;
                        return (
                          <button
                            key={`${q.id}-${option.value}`}
                            onClick={() => setAnswers((s) => ({ ...s, [q.id]: option.value }))}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                              active
                                ? "border-[rgb(var(--violet-rgb)/0.6)] bg-[rgb(var(--violet-rgb)/0.2)] text-white"
                                : "border-border bg-[rgb(var(--surface-1-rgb)/0.6)] text-muted hover:bg-surface2/56"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-action" />
                <p className="text-sm font-semibold">Дополнительные ответы</p>
              </div>
              <Textarea
                placeholder="Какой формат знакомства для тебя сейчас важнее всего?"
                value={openAnswers.social_goal}
                onChange={(e) => setOpenAnswers((s) => ({ ...s, social_goal: e.target.value }))}
              />
              <Textarea
                placeholder="Что точно не подходит в общении / знакомствах?"
                value={openAnswers.deal_breakers}
                onChange={(e) => setOpenAnswers((s) => ({ ...s, deal_breakers: e.target.value }))}
              />
              <Textarea
                placeholder="На какие темы тебе легче всего начать разговор?"
                value={openAnswers.conversation_topics}
                onChange={(e) => setOpenAnswers((s) => ({ ...s, conversation_topics: e.target.value }))}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 pb-2">
          {step === 0 ? (
            <Link href="/profile/me/psych-test" className="block">
              <Button variant="secondary" className="w-full">Назад</Button>
            </Link>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Назад
            </Button>
          )}
          {step < chunks.length ? (
            <Button onClick={() => canGoNext && setStep((s) => s + 1)} disabled={!canGoNext}>
              Далее <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={loading || !ready}>
              {loading ? "Сохраняем..." : "Сохранить тест"}
            </Button>
          )}
        </div>
      </motion.div>
    </PageShell>
  );
}
