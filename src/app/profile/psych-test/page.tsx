"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Brain, Sparkles } from "lucide-react";
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
};

const QUESTIONS: Question[] = [
  { id: "q1", trait: "openness", text: "Мне интересно исследовать новые подходы и идеи" },
  { id: "q2", trait: "openness", reverse: true, text: "Я избегаю всего незнакомого" },
  { id: "q3", trait: "conscientiousness", text: "Я предпочитаю планировать и доводить дела до конца" },
  { id: "q4", trait: "conscientiousness", reverse: true, text: "Мне сложно держать структуру и режим" },
  { id: "q5", trait: "extraversion", text: "Я быстро включаюсь в общение с новыми людьми" },
  { id: "q6", trait: "extraversion", reverse: true, text: "После общения с людьми я чаще устаю" },
  { id: "q7", trait: "agreeableness", text: "Мне важно быть деликатным и учитывать эмоции других" },
  { id: "q8", trait: "agreeableness", reverse: true, text: "В споре я чаще иду жёстко до конца" },
  { id: "q9", trait: "neuroticism", text: "Я легко начинаю переживать из-за неопределённости" },
  { id: "q10", trait: "neuroticism", reverse: true, text: "Я обычно сохраняю спокойствие в стрессовых ситуациях" },
  { id: "q11", trait: "openness", text: "Люблю обсуждать смыслы, ценности, долгие идеи" },
  { id: "q12", trait: "agreeableness", text: "Мне важно строить контакт через доверие и уважение" },
  { id: "q13", trait: "extraversion", text: "Мне нравится знакомиться в офлайн-движении (ивенты, прогулки)" },
  { id: "q14", trait: "conscientiousness", text: "Для меня важны договорённости и пунктуальность" },
  { id: "q15", trait: "neuroticism", reverse: true, text: "Даже в сложном диалоге я умею сохранять баланс" },
];

const OPTIONS = [
  { value: 1, label: "Совсем не про меня" },
  { value: 2, label: "Скорее нет" },
  { value: 3, label: "Частично" },
  { value: 4, label: "Скорее да" },
  { value: 5, label: "Очень похоже" },
];

export default function PsychTestPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setAgreed(params.get("agree") === "1");
  }, []);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [openAnswers, setOpenAnswers] = useState({
    social_goal: "",
    deal_breakers: "",
    conversation_topics: "",
  });
  const [loading, setLoading] = useState(false);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const ready = answeredCount >= QUESTIONS.length;

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
      router.push("/profile/me");
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

  return (
    <PageShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <Card className="overflow-hidden border-borderStrong">
          <div className="h-28 bg-[radial-gradient(circle_at_20%_20%,rgb(var(--mint-rgb) / 0.38),transparent_45%),radial-gradient(circle_at_80%_20%,rgb(var(--blue-rgb) / 0.5),transparent_45%),linear-gradient(130deg,rgb(var(--surface-2-rgb)),rgb(var(--surface-3-rgb)))]" />
          <CardContent className="-mt-8 space-y-2 p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-border bg-[rgb(var(--surface-1-rgb)/0.6)] p-2"><Brain className="h-5 w-5" /></div>
              <h1 className="text-xl font-semibold">Психологический профиль знакомства</h1>
            </div>
            <p className="text-sm text-muted">Основа: валидированные черты Big Five (адаптированная короткая форма для соцсценариев).</p>
            <p className="text-xs text-muted">Заполнено: {answeredCount}/{QUESTIONS.length}</p>
          </CardContent>
        </Card>

        {QUESTIONS.map((q, idx) => (
          <Card key={q.id} className="border-border">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">{idx + 1}. {q.text}</p>
              <div className="grid grid-cols-1 gap-2">
                {OPTIONS.map((option) => {
                  const active = answers[q.id] === option.value;
                  return (
                    <button
                      key={`${q.id}-${option.value}`}
                      onClick={() => setAnswers((s) => ({ ...s, [q.id]: option.value }))}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active ? "border-mint/70 bg-mint/18 text-mint/90" : "border-border bg-[rgb(var(--surface-1-rgb)/0.6)] text-muted hover:bg-surface2/56"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-border">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-action" />
              <p className="text-sm font-semibold">Дополнительные ответы (свободная форма)</p>
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

        <div className="grid grid-cols-2 gap-2 pb-2">
          <Link href="/profile/me/psych-test" className="block"><Button variant="secondary" className="w-full">Назад</Button></Link>
          <Button onClick={submit} disabled={loading || !ready}>{loading ? "Сохраняем..." : "Сохранить тест"}</Button>
        </div>
      </motion.div>
    </PageShell>
  );
}
