"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
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

type SessionsResponse = {
  current_session_id: string | null;
  current: SessionItem | null;
  items: SessionItem[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function parsePlatform(ua: string | null) {
  if (!ua) return "Web";
  if (/iphone|ios/i.test(ua)) return "iPhone / iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os|macintosh/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  return "Web";
}

export default function ProfileSessionsPage() {
  const queryClient = useQueryClient();
  const [revokingIds, setRevokingIds] = useState<Record<string, boolean>>({});
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["profile-sessions-page"],
    queryFn: () => api<SessionsResponse>("/api/profile/sessions"),
  });

  useEffect(() => {
    if (sessionsQuery.data) {
      setSessions(sessionsQuery.data);
    }
  }, [sessionsQuery.data]);

  const current = sessions?.current ?? null;
  const items = sessions?.items ?? [];

  const activeCount = useMemo(() => items.filter((s) => !s.revoked_at).length, [items]);

  async function revokeSession(sessionId: string) {
    const snapshot = sessions;
    if (!snapshot) return;

    const target = snapshot.items.find((s) => s.id === sessionId);
    if (!target) return;

    setRevokingIds((prev) => ({ ...prev, [sessionId]: true }));

    const optimistic: SessionsResponse = {
      ...snapshot,
      current: snapshot.current?.id === sessionId ? null : snapshot.current,
      items: snapshot.items.filter((s) => s.id !== sessionId),
    };

    setSessions(optimistic);
    queryClient.setQueryData(["profile-sessions-page"], optimistic);

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
      setSessions(snapshot);
      queryClient.setQueryData(["profile-sessions-page"], snapshot);
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессию");
    } finally {
      setRevokingIds((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
  }

  async function revokeAll() {
    if (!sessions) return;

    const snapshot = sessions;
    const optimistic: SessionsResponse = {
      ...snapshot,
      items: snapshot.items.filter((s) => s.is_current),
    };

    setRevokeAllLoading(true);
    setSessions(optimistic);
    queryClient.setQueryData(["profile-sessions-page"], optimistic);

    try {
      await api<{ success: boolean; revoked_count: number }>("/api/profile/sessions/revoke-all", {
        method: "POST",
        body: JSON.stringify({ except_current: true }),
      });
      await sessionsQuery.refetch();
      toast.success("Сессии завершены");
    } catch (e) {
      setSessions(snapshot);
      queryClient.setQueryData(["profile-sessions-page"], snapshot);
      toast.error(e instanceof Error ? e.message : "Не удалось завершить сессии");
    } finally {
      setRevokeAllLoading(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Устройства и активные сессии" subtitle="Контролируй входы как в Telegram: текущая сессия и безопасное завершение остальных.">
      <Card className="border-border bg-surface/90 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-sm text-text">Текущее устройство</CardTitle>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="rounded-2xl border border-blue/35 bg-blue/14 p-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-border bg-surface2/72 p-2 text-text"><Smartphone className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{current.device_label || "Текущее устройство"}</p>
                  <p className="text-xs text-text2">{parsePlatform(current.user_agent)}</p>
                  <p className="mt-1 text-xs text-text2">Локация: {current.approx_location || "—"}</p>
                  <p className="text-xs text-text2">Активность: {formatDate(current.last_active_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface2/64 p-3 text-xs text-text2">Текущая сессия не найдена.</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/88 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-sm text-text">Активные сессии ({activeCount})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length ? (
            items.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-surface2/64 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{s.device_label || "Устройство"}</p>
                    <p className="text-xs text-text2">{parsePlatform(s.user_agent)} · {s.approx_location || "Локация недоступна"}</p>
                    <p className="text-xs text-text2">Был(а): {formatDate(s.last_active_at)}</p>
                    <p className="text-[11px] text-text3">Вход: {formatDate(s.created_at)}</p>
                  </div>

                  {s.is_current ? (
                    <span className="rounded-full border border-mint/45 bg-mint/12 px-2 py-1 text-[10px] text-mint/90">Текущее</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => revokeSession(s.id)}
                      disabled={Boolean(revokingIds[s.id])}
                      className="shrink-0"
                    >
                      {revokingIds[s.id] ? "Завершаем..." : "Завершить"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-surface2/64 p-3 text-xs text-text2">Других активных сессий нет.</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber/35 bg-amber/10">
        <CardContent className="space-y-3 p-4">
          <p className="inline-flex items-center gap-2 text-xs text-amber/90">
            <ShieldAlert className="h-4 w-4" /> Если устройство не твое, заверши все сессии кроме текущей.
          </p>
          <Button variant="danger" className="w-full" onClick={revokeAll} disabled={revokeAllLoading || sessionsQuery.isLoading}>
            <Trash2 className="mr-1 h-4 w-4" /> {revokeAllLoading ? "Завершаем..." : "Завершить все кроме текущей"}
          </Button>
          <div className="inline-flex items-center gap-2 text-[11px] text-text2">
            <Monitor className="h-3.5 w-3.5" /> Изменения применяются сразу и сохраняются в безопасности аккаунта.
          </div>
        </CardContent>
      </Card>
    </ProfileSettingsLayout>
  );
}
