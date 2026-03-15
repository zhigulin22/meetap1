"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock, Trophy } from "lucide-react";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { BadgeIcon } from "@/components/badge-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

type BadgeItem = {
  id: string;
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  tier: number;
  rules: {
    metric?: string;
    target?: number;
    cooldown_days?: number;
    value_label?: string;
    why?: string;
  };
  earned: boolean;
  earned_at: string | null;
  is_featured: boolean;
  progress: {
    current: number;
    target: number;
    percent: number;
  };
};

type BadgesPayload = {
  featured: BadgeItem | null;
  earnedCount: number;
  totalCount: number;
  categories: string[];
  items: BadgeItem[];
};

const CATEGORY_TABS = [
  "Получено",
  "Социальные связи",
  "Мероприятия",
  "Контент",
  "Стабильность",
  "Комьюнити",
  "Сезонные миссии",
] as const;

const RARITY_LABEL: Record<BadgeItem["rarity"], string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const RARITY_ORDER: Record<BadgeItem["rarity"], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

export default function ProfileAchievementsPage() {
  const [mode, setMode] = useState<"earned" | "all">("all");
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]>("Получено");
  const [selected, setSelected] = useState<BadgeItem | null>(null);

  const badgesQuery = useQuery({
    queryKey: ["profile-badges-v2"],
    queryFn: () => api<BadgesPayload>("/api/profile/badges"),
  });

  async function featureBadge(badgeId: string) {
    await api("/api/profile/badges/feature", { method: "POST", body: JSON.stringify({ badgeId }) });
    await badgesQuery.refetch();
  }

  const items = badgesQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      if (RARITY_ORDER[a.rarity] !== RARITY_ORDER[b.rarity]) return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
      if (a.category !== b.category) return a.category.localeCompare(b.category, "ru");
      if (a.tier !== b.tier) return b.tier - a.tier;
      return a.title.localeCompare(b.title, "ru");
    });

    return sorted.filter((item) => {
      const modePass = mode === "all" ? true : item.earned;
      const categoryPass = category === "Получено" ? item.earned : item.category === category;
      return modePass && categoryPass;
    });
  }, [items, mode, category]);

  const topEventNamesHint = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of items) {
      const key = item.rules.metric ?? "unknown_metric";
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => `${key} (${count})`)
      .join(" · ");
  }, [items]);

  return (
    <ProfileSettingsLayout title="Достижения" subtitle="Бейджи рассчитаны на месяцы и годы. Не полученные — монохромные, полученные — яркие и поднимаются вверх.">
      <Card className="border-border bg-[rgb(var(--surface-2-rgb)/0.9)] shadow-card backdrop-blur-2xl badge-mode">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">Прогресс по бейджам</p>
              <p className="text-xs text-text2">Получено {badgesQuery.data?.earnedCount ?? 0} из {badgesQuery.data?.totalCount ?? 0}</p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-[rgb(var(--surface-1-rgb)/0.78)] p-1">
              <button
                type="button"
                onClick={() => setMode("earned")}
                className={`rounded-lg px-3 py-1 text-xs transition ${mode === "earned" ? "bg-[rgb(var(--violet-rgb)/0.2)] text-text" : "text-text3"}`}
              >
                Получено
              </button>
              <button
                type="button"
                onClick={() => setMode("all")}
                className={`rounded-lg px-3 py-1 text-xs transition ${mode === "all" ? "bg-[rgb(var(--violet-rgb)/0.2)] text-text" : "text-text3"}`}
              >
                Все
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                  category === tab ? "border-violet/45 bg-[rgb(var(--violet-rgb)/0.16)] text-text" : "border-border bg-[rgb(var(--surface-1-rgb)/0.72)] text-text3"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-[rgb(var(--surface-2-rgb)/0.9)] shadow-card backdrop-blur-2xl badge-mode">
        <CardHeader>
          <CardTitle className="text-sm text-text">Каталог бейджей</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length ? (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelected(badge)}
                  className={`group rounded-2xl border p-3 text-left transition active:scale-[0.985] ${
                    badge.earned
                      ? "border-violet/35 bg-[linear-gradient(135deg,rgb(var(--violet-rgb)/0.14),rgb(var(--citrus-rgb)/0.12))]"
                      : "border-border bg-[rgb(var(--surface-1-rgb)/0.6)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <BadgeIcon name={badge.icon} rarity={badge.rarity} earned={badge.earned} />
                    {badge.earned ? (
                      <CheckCircle2 className="h-4 w-4 text-mint" />
                    ) : (
                      <Lock className="h-4 w-4 text-text3" />
                    )}
                  </div>

                  <p className={`mt-2 text-sm font-semibold ${badge.earned ? "text-text" : "text-text2"}`}>{badge.title}</p>
                  <p className={`mt-0.5 text-[11px] ${badge.earned ? "text-text2" : "text-text3"}`}>
                    {badge.category} · {RARITY_LABEL[badge.rarity]}
                  </p>

                  <div className="mt-2 h-1.5 rounded-full bg-surface2/72">
                    <div className="h-1.5 rounded-full bg-[image:var(--grad-badge)]" style={{ width: `${Math.min(100, badge.progress.percent)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-text3">{badge.progress.current}/{badge.progress.target}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] p-4 text-sm text-text2">
              <p>Пока пусто для выбранного фильтра.</p>
              <p className="mt-1 text-xs text-text3">Сбрось фильтр или открывай “Все”, чтобы увидеть полный каталог.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {mode === "all" && category !== "Получено" ? (
        <Card className="border-border bg-[rgb(var(--surface-1-rgb)/0.72)]">
          <CardContent className="p-3 text-xs text-text3">
            Сопоставление метрик: {topEventNamesHint || "—"}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(next) => (next ? undefined : setSelected(null))}>
        <DialogHeader>
          <DialogTitle>Детали бейджа</DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1 badge-mode">
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.74)] p-3">
              <div className="flex items-center gap-3">
                <BadgeIcon name={selected.icon} rarity={selected.rarity} earned={selected.earned} />
                <div>
                  <p className="text-sm font-semibold text-text">{selected.title}</p>
                  <p className="text-xs text-text2">{selected.category} · {RARITY_LABEL[selected.rarity]} · Tier {selected.tier}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.74)] p-3">
              <p className="text-xs text-text3">Что это</p>
              <p className="mt-1 text-sm text-text">{selected.description}</p>
              <p className="mt-2 text-xs text-text3">Почему ценно: {selected.rules.why || "Повышает качество профиля и рекомендаций."}</p>
            </div>

            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.74)] p-3">
              <p className="text-xs text-text3">Прогресс</p>
              <div className="mt-2 h-2 rounded-full bg-surface2/72">
                <div className="h-2 rounded-full bg-[image:var(--grad-badge)]" style={{ width: `${Math.min(100, selected.progress.percent)}%` }} />
              </div>
              <p className="mt-1 text-sm text-text">{selected.progress.current}/{selected.progress.target} {selected.rules.value_label || "шагов"}</p>
            </div>

            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.74)] p-3 text-sm">
              <p className="text-xs text-text3">Условия</p>
              <p className="mt-1 text-text">Нужно: {selected.progress.target} {selected.rules.value_label || "действий"}.</p>
              <p className="text-text2">Cooldown: {selected.rules.cooldown_days ?? 30} дн.</p>
              <p className="text-text2">Дата получения: {formatDate(selected.earned_at)}</p>
            </div>

            {selected.earned ? (
              <Button className="w-full" onClick={() => featureBadge(selected.id)}>
                <Trophy className="mr-1 h-4 w-4" /> Сделать главным бейджем
              </Button>
            ) : (
              <div className="rounded-2xl border border-border bg-[rgb(var(--surface-1-rgb)/0.72)] p-3 text-xs text-text2">
                Бейдж еще не получен. Прогресс сохранен и продолжит расти автоматически.
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => setSelected(null)}>
              Закрыть
            </Button>
          </div>
        ) : null}
      </Dialog>
    </ProfileSettingsLayout>
  );
}
