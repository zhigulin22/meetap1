"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { api } from "@/lib/api-client";

function SwitchRow({
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
      className="tap-press flex min-h-[62px] w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.78)] px-3 py-2.5 text-left"
    >
      <div>
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-text2">{hint}</p>
      </div>
      <ToggleSwitch checked={checked} onCheckedChange={onChange} ariaLabel={label} />
    </button>
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
      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-sm text-text">
            <Bell className="h-4 w-4" /> Активность и связи
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SwitchRow label="Лайки" hint="Реакции на твой контент" checked={state.likes} onChange={(v) => setState((s) => ({ ...s, likes: v }))} />
          <SwitchRow label="Комментарии" hint="Новые комментарии и ответы" checked={state.comments} onChange={(v) => setState((s) => ({ ...s, comments: v }))} />
          <SwitchRow label="События" hint="Напоминания и изменения по ивентам" checked={state.events} onChange={(v) => setState((s) => ({ ...s, events: v }))} />
          <SwitchRow label="Коннекты" hint="Запросы знакомства и ответы" checked={state.connections} onChange={(v) => setState((s) => ({ ...s, connections: v }))} />
          <SwitchRow label="Недельный дайджест" hint="Короткая сводка раз в неделю" checked={state.weeklyDigest} onChange={(v) => setState((s) => ({ ...s, weeklyDigest: v }))} />
        </CardContent>
      </Card>

      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader>
          <CardTitle className="text-sm text-text">Канал доставки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SwitchRow label="Push" hint="Уведомления в приложении/браузере" checked={state.push} onChange={(v) => setState((s) => ({ ...s, push: v }))} />
          <SwitchRow label="Email" hint="Дублировать важные события в почту" checked={state.email} onChange={(v) => setState((s) => ({ ...s, email: v }))} />

          <div className="mt-1 grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.68)] p-3">
            <p className="inline-flex items-center gap-1 text-[12px] text-text2">
              <Smartphone className="h-3.5 w-3.5" /> Push
            </p>
            <p className="inline-flex items-center justify-end gap-1 text-[12px] text-text2">
              <Mail className="h-3.5 w-3.5" /> Email
            </p>
          </div>
        </CardContent>
      </Card>

      <Button className="mt-1 w-full" onClick={save} disabled={saving || meQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </ProfileSettingsLayout>
  );
}
