"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type SessionItem = {
  id: string;
  device_label: string;
  user_agent: string | null;
  approx_location: string | null;
  created_at: string;
  last_active_at: string;
  revoked_at: string | null;
  is_current: boolean;
};

export default function ProfileSessionsPage() {
  const sessionsQuery = useQuery({
    queryKey: ["profile-sessions-page"],
    queryFn: () =>
      api<{ current_session_id: string | null; current: SessionItem | null; items: SessionItem[] }>("/api/profile/sessions"),
  });

  async function revokeSession(sessionId: string) {
    try {
      const result = await api<{ success: boolean; signed_out: boolean }>("/api/profile/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (result.signed_out) {
        window.location.href = "/login";
        return;
      }
      await sessionsQuery.refetch();
      toast.success("Сессия завершена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессию");
    }
  }

  async function revokeAll() {
    try {
      await api<{ success: boolean; revoked_count: number }>("/api/profile/sessions/revoke-all", {
        method: "POST",
        body: JSON.stringify({ except_current: true }),
      });
      await sessionsQuery.refetch();
      toast.success("Сессии завершены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессии");
    }
  }

  const current = sessionsQuery.data?.current ?? null;
  const items = sessionsQuery.data?.items ?? [];

  return (
    <ProfileSettingsLayout title="Устройства и активные сессии" subtitle="Как в Telegram: текущее устройство + история входов">
      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Текущее устройство</CardTitle></CardHeader>
        <CardContent>
          {current ? (
            <div className="rounded-xl border border-action/30 bg-action/10 p-3">
              <p className="text-sm text-text">{current.device_label}</p>
              <p className="text-xs text-muted">Локация: {current.approx_location || "—"}</p>
              <p className="text-xs text-muted">Активность: {new Date(current.last_active_at).toLocaleString("ru-RU")}</p>
            </div>
          ) : (
            <p className="text-xs text-muted">Текущая сессия не найдена</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Активные сессии</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length ? (
            items.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-text">{s.device_label}</p>
                    <p className="text-xs text-muted">{s.approx_location || "Локация недоступна"}</p>
                    <p className="text-xs text-muted">Был(а): {new Date(s.last_active_at).toLocaleString("ru-RU")}</p>
                  </div>
                  {s.is_current ? (
                    <span className="rounded-full border border-action/30 bg-action/10 px-2 py-1 text-[10px] text-action">Текущее</span>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => revokeSession(s.id)}>
                      Завершить
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted">Сессий нет</p>
          )}
        </CardContent>
      </Card>

      <Button variant="secondary" className="w-full" onClick={revokeAll} disabled={sessionsQuery.isLoading}>
        Завершить все кроме текущей
      </Button>
    </ProfileSettingsLayout>
  );
}
