"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface2/70 px-3 py-2">
      <div>
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-mint" />
    </label>
  );
}

export default function ProfileNotificationsPage() {
  const [state, setState] = useState({
    likes: true,
    comments: true,
    events: true,
    connections: true,
    weeklyDigest: true,
    push: true,
    email: false,
  });
  const [saving, setSaving] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-notifications-me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  useEffect(() => {
    const n = meQuery.data?.profile?.notification_settings;
    if (!n) return;
    setState({
      likes: n.likes ?? true,
      comments: n.comments ?? true,
      events: n.events ?? true,
      connections: n.connections ?? true,
      weeklyDigest: n.weeklyDigest ?? true,
      push: n.push ?? true,
      email: n.email ?? false,
    });
  }, [meQuery.data]);

  async function save() {
    try {
      setSaving(true);
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify({ notification_settings: state }) });
      await meQuery.refetch();
      toast.success("Уведомления сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Уведомления" subtitle="Важные сигналы: коннекты, ответы, события">
      <div className="space-y-2">
        <SwitchRow label="Лайки" hint="Реакции на контент" checked={state.likes} onChange={(v) => setState((s) => ({ ...s, likes: v }))} />
        <SwitchRow label="Комментарии" hint="Новые комментарии" checked={state.comments} onChange={(v) => setState((s) => ({ ...s, comments: v }))} />
        <SwitchRow label="События" hint="Напоминания и изменения" checked={state.events} onChange={(v) => setState((s) => ({ ...s, events: v }))} />
        <SwitchRow label="Коннекты" hint="Запросы и ответы" checked={state.connections} onChange={(v) => setState((s) => ({ ...s, connections: v }))} />
        <SwitchRow label="Недельный дайджест" hint="Краткий weekly обзор" checked={state.weeklyDigest} onChange={(v) => setState((s) => ({ ...s, weeklyDigest: v }))} />
        <SwitchRow label="Push" hint="Уведомления в приложении/браузере" checked={state.push} onChange={(v) => setState((s) => ({ ...s, push: v }))} />
        <SwitchRow label="Email" hint="Дублировать в почту" checked={state.email} onChange={(v) => setState((s) => ({ ...s, email: v }))} />
      </div>

      <Button className="mt-3 w-full" onClick={save} disabled={saving || meQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </ProfileSettingsLayout>
  );
}
