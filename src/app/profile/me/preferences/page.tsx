"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/tag-input";
import { api } from "@/lib/api-client";

const schema = z.object({
  mode: z.enum(["dating", "networking", "both"]),
  intent: z.string().trim().max(120),
  meetupFrequency: z.enum(["low", "medium", "high"]),
  lookingFor: z.array(z.string().trim().max(40)).min(1).max(6),
});

export default function ProfilePreferencesPage() {
  const [mode, setMode] = useState<"dating" | "networking" | "both">("both");
  const [intent, setIntent] = useState("");
  const [meetupFrequency, setMeetupFrequency] = useState<"low" | "medium" | "high">("medium");
  const [lookingFor, setLookingFor] = useState<string[]>(["друзья", "нетворк"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["profile-preferences-me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  useEffect(() => {
    const p = meQuery.data?.profile?.preferences;
    if (!p) return;
    setMode(p.mode ?? "both");
    setIntent(p.intent ?? "");
    setMeetupFrequency(p.meetupFrequency ?? "medium");
    setLookingFor(Array.isArray(p.lookingFor) && p.lookingFor.length ? p.lookingFor : ["друзья", "нетворк"]);
  }, [meQuery.data]);

  async function save() {
    const parsed = schema.safeParse({ mode, intent, meetupFrequency, lookingFor });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверь настройки");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify({ preferences: parsed.data }) });
      await meQuery.refetch();
      toast.success("Настройки знакомств сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Настройки знакомств/нетворкинга" subtitle="Это использует алгоритм подбора и AI-подсказки">
      <Card className="mb-3">
        <CardContent className="space-y-3 p-3">
          <p className="text-xs text-muted">Что ищу</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["dating", "Знакомства"],
              ["networking", "Нетворк"],
              ["both", "Оба"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as typeof mode)}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  mode === value ? "border-action bg-action/20 text-action" : "border-border bg-black/10 text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="Цель: кого хочешь встретить сейчас" />

      <Card className="my-3">
        <CardContent className="space-y-2 p-3">
          <p className="text-xs text-muted">Фокус поиска</p>
          <TagInput
            value={lookingFor}
            onChange={setLookingFor}
            suggestions={["друзья", "нетворк", "отношения", "ивенты", "кофаундер", "партнер", "ментор"]}
            min={1}
            max={6}
            placeholder="Добавь цель и Enter"
          />
        </CardContent>
      </Card>

      <select
        value={meetupFrequency}
        onChange={(e) => setMeetupFrequency(e.target.value as typeof meetupFrequency)}
        className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
      >
        <option value="low">Редко</option>
        <option value="medium">Средне</option>
        <option value="high">Часто</option>
      </select>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <Button className="mt-3 w-full" onClick={save} disabled={saving || meQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </ProfileSettingsLayout>
  );
}
