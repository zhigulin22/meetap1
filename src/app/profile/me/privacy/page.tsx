"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

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

type BlockedUser = { id: string; name: string; avatar_url: string | null };

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface2/64 px-3 py-2 text-left transition active:scale-[0.988]"
    >
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text2">{hint}</p>
      </div>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition ${
          checked ? "border-mint/50 bg-mint/25" : "border-borderStrong bg-surface2/72"
        }`}
      >
        <span className={`h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

export default function ProfilePrivacyPage() {
  const queryClient = useQueryClient();
  const [privacy, setPrivacy] = useState<PrivacySettings>({
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cacheClearing, setCacheClearing] = useState(false);

  const privacyQuery = useQuery({
    queryKey: ["profile-privacy-page"],
    queryFn: () => api<{ settings: PrivacySettings; blocked_users: BlockedUser[] }>("/api/profile/privacy"),
  });

  useEffect(() => {
    if (privacyQuery.data?.settings) {
      setPrivacy(privacyQuery.data.settings);
    }
  }, [privacyQuery.data]);

  async function save() {
    try {
      setSaving(true);
      setError("");
      await api("/api/profile/privacy", { method: "PUT", body: JSON.stringify(privacy) });
      await privacyQuery.refetch();
      toast.success("Настройки приватности сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function clearAppCache() {
    try {
      setCacheClearing(true);

      const keys = Object.keys(localStorage).filter((k) => k.startsWith("meetap_"));
      keys.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();

      queryClient.clear();

      if (typeof window !== "undefined" && "caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      }

      toast.success("Кэш приложения очищен");
      await privacyQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось очистить кэш");
    } finally {
      setCacheClearing(false);
    }
  }

  const blocked = privacyQuery.data?.blocked_users ?? [];

  return (
    <ProfileSettingsLayout title="Конфиденциальность и безопасность" subtitle="Тонкая настройка видимости, общения и локальной безопасности.">
      <Card className="border-border bg-surface/90 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-sm text-text">Кто видит</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2 rounded-2xl border border-border bg-surface2/64 p-3">
            <p className="text-xs text-text2">Телефон</p>
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
                  className={`rounded-xl border px-3 py-2 text-xs transition ${
                    privacy.phone_visibility === value
                      ? "border-blue/45 bg-blue/16 text-text"
                      : "border-border bg-surface2/60 text-text2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow label="Факты" hint="Показывать карточки фактов в публичном профиле" checked={privacy.show_facts} onChange={(v) => setPrivacy((p) => ({ ...p, show_facts: v }))} />
          <ToggleRow label="Интересы" hint="Показывать чипы интересов" checked={privacy.show_interests} onChange={(v) => setPrivacy((p) => ({ ...p, show_interests: v }))} />
          <ToggleRow label="История мероприятий" hint="Показывать посещенные события" checked={privacy.show_event_history} onChange={(v) => setPrivacy((p) => ({ ...p, show_event_history: v }))} />
          <ToggleRow label="Город" hint="Показывать город в публичном профиле" checked={privacy.show_city} onChange={(v) => setPrivacy((p) => ({ ...p, show_city: v }))} />
          <ToggleRow label="Работа / деятельность" hint="Показывать профессиональный контекст" checked={privacy.show_work} onChange={(v) => setPrivacy((p) => ({ ...p, show_work: v }))} />
          <ToggleRow label="ВУЗ" hint="Показывать университет" checked={privacy.show_university} onChange={(v) => setPrivacy((p) => ({ ...p, show_university: v }))} />
          <ToggleRow label="Последняя активность" hint="Показывать статус 'был(а) недавно'" checked={privacy.show_last_active} onChange={(v) => setPrivacy((p) => ({ ...p, show_last_active: v }))} />
          <ToggleRow label="Бейджи" hint="Показывать полученные достижения" checked={privacy.show_badges} onChange={(v) => setPrivacy((p) => ({ ...p, show_badges: v }))} />
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/88 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-sm text-text">Кто может писать</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={privacy.who_can_message}
            onChange={(e) => setPrivacy((prev) => ({ ...prev, who_can_message: e.target.value as PrivacySettings["who_can_message"] }))}
            className="h-11 w-full rounded-xl border border-borderStrong bg-surface2/68 px-3 text-sm text-text"
          >
            <option value="everyone" className="text-black">Все</option>
            <option value="shared_events" className="text-black">Только участники общих событий</option>
            <option value="connections" className="text-black">Только контакты</option>
          </select>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/88 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-sm text-text">Блокировки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {blocked.length ? (
            blocked.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface2/64 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Image src={u.avatar_url || "https://placehold.co/80x80"} alt={u.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                  <p className="truncate text-sm text-text">{u.name}</p>
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
            <p className="text-xs text-text2">Список блокировок пуст</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue/30 bg-blue/9">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-sm text-text"><Shield className="h-4 w-4" /> Кэш приложения</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-text2">Если видишь старые данные или интерфейс ведет себя нестабильно, можно очистить локальный кэш.</p>
          <Button variant="secondary" className="w-full" onClick={clearAppCache} disabled={cacheClearing}>
            <Trash2 className="mr-1 h-4 w-4" /> {cacheClearing ? "Очищаем..." : "Очистить кэш"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Button className="w-full" onClick={save} disabled={saving || privacyQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить приватность"}
      </Button>
    </ProfileSettingsLayout>
  );
}
