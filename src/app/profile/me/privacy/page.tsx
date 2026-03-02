"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface2/70 px-3 py-2">
      <div>
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#52CC83]" />
    </label>
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
    queryFn: () => api<{ settings: PrivacySettings; blocked_users: Array<{ id: string; name: string; avatar_url: string | null }> }>("/api/profile/privacy"),
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
    <ProfileSettingsLayout title="Конфиденциальность и безопасность" subtitle="Тонкая настройка видимости и доступа">
      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Кто видит</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2 rounded-xl border border-border bg-surface2/70 p-3">
            <p className="text-xs text-muted">Телефон</p>
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
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    privacy.phone_visibility === value ? "border-action bg-action/20 text-action" : "border-border bg-black/10 text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <SwitchRow label="Факты" hint="Показывать факты в публичном профиле" checked={privacy.show_facts} onChange={(v) => setPrivacy((p) => ({ ...p, show_facts: v }))} />
          <SwitchRow label="Интересы" hint="Показывать чипы интересов" checked={privacy.show_interests} onChange={(v) => setPrivacy((p) => ({ ...p, show_interests: v }))} />
          <SwitchRow label="История мероприятий" hint="Показывать посещенные события" checked={privacy.show_event_history} onChange={(v) => setPrivacy((p) => ({ ...p, show_event_history: v }))} />
          <SwitchRow label="Город" hint="Показывать город в публичном профиле" checked={privacy.show_city} onChange={(v) => setPrivacy((p) => ({ ...p, show_city: v }))} />
          <SwitchRow label="Работа/деятельность" hint="Показывать профконтекст" checked={privacy.show_work} onChange={(v) => setPrivacy((p) => ({ ...p, show_work: v }))} />
          <SwitchRow label="ВУЗ" hint="Показывать университет" checked={privacy.show_university} onChange={(v) => setPrivacy((p) => ({ ...p, show_university: v }))} />
          <SwitchRow label="Последняя активность" hint="Показывать статус 'был недавно'" checked={privacy.show_last_active} onChange={(v) => setPrivacy((p) => ({ ...p, show_last_active: v }))} />
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Кто может писать</CardTitle></CardHeader>
        <CardContent>
          <select
            value={privacy.who_can_message}
            onChange={(e) => setPrivacy((prev) => ({ ...prev, who_can_message: e.target.value as PrivacySettings["who_can_message"] }))}
            className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
          >
            <option value="everyone">Все</option>
            <option value="shared_events">Только участники общих событий</option>
            <option value="connections">Только контакты</option>
          </select>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Блокировки</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {blocked.length ? (
            blocked.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-surface2/70 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Image src={u.avatar_url || "https://placehold.co/80x80"} alt={u.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                  <p className="text-sm text-text">{u.name}</p>
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
            <p className="text-xs text-muted">Список блокировок пуст</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Кэш приложения</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted">Если интерфейс работает нестабильно или видишь старые данные — очисти локальный кэш.</p>
          <Button variant="secondary" className="w-full" onClick={clearAppCache} disabled={cacheClearing}>
            {cacheClearing ? "Очищаем..." : "Очистить кэш"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}

      <Button className="w-full" onClick={save} disabled={saving || privacyQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить приватность"}
      </Button>
    </ProfileSettingsLayout>
  );
}
