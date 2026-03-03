"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, CheckCircle2, Shield } from "lucide-react";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export default function ProfilePsychIntroPage() {
  const [agreed, setAgreed] = useState(false);

  const psychQuery = useQuery({
    queryKey: ["psych-status-v1"],
    queryFn: () => api<{ completed: boolean; updated_at: string | null; style: string | null }>("/api/profile/psych-test"),
  });

  const statusText = useMemo(() => {
    if (psychQuery.isLoading) return "Проверяем статус...";
    if (!psychQuery.data?.completed) return "Тест не пройден";
    const date = psychQuery.data.updated_at ? new Date(psychQuery.data.updated_at).toLocaleDateString("ru-RU") : "—";
    return `Пройден · обновлен ${date}`;
  }, [psychQuery.data, psychQuery.isLoading]);

  return (
    <ProfileSettingsLayout title="Психотест" subtitle="Нужен для более точных рекомендаций и подсказок знакомства">
      <Card className="mb-3 overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <div className="h-24 bg-[linear-gradient(125deg,rgb(var(--surface-2-rgb)/0.98),rgb(var(--teal-rgb)/0.24),rgb(var(--sky-rgb)/0.28))]" />
        <CardContent className="-mt-6 p-4">
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.76)] px-3 py-2 text-sm text-text">
            <Brain className="h-4 w-4 text-action" />
            {statusText}
          </div>
          <p className="text-sm text-text2">
            Мы используем результаты теста только для внутренних алгоритмов: рекомендации людей, точки пересечения интересов и
            подсказки первого шага в знакомстве.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-3 border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader><CardTitle className="text-sm text-text">Что это даст</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-text2">
          <p>1. Более точный match по стилю общения и целям знакомства.</p>
          <p>2. Персональные идеи первого сообщения и сценариев знакомства.</p>
          <p>3. Меньше случайных несовпадений и больше релевантных контактов.</p>
        </CardContent>
      </Card>

      <Card className="mb-3 border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader><CardTitle className="text-sm text-text">Приватность</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-text2">
          <p className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> Результаты не показываются другим пользователям публично.</p>
          <p className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-action" /> Можно пройти сейчас и обновлять позже.</p>
        </CardContent>
      </Card>

      <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.74)] px-3 py-2 text-sm text-text2">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-mint" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        Я понимаю, что результаты используются для внутренних рекомендаций знакомств и подсказок первого шага.
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/profile/me" className="block"><Button variant="secondary" className="w-full">Позже</Button></Link>
        <Link href={agreed ? "/profile/psych-test?agree=1" : "#"} className="block">
          <Button className="w-full" disabled={!agreed}>Начать тест</Button>
        </Link>
      </div>
    </ProfileSettingsLayout>
  );
}
