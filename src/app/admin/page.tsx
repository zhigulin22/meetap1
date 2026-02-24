"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert, Search, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type Overview = {
  kpis: {
    usersTotal: number;
    dau: number;
    wau: number;
    mau: number;
    posts7d: number;
    comments7d: number;
    eventJoins7d: number;
    openFlags: number;
    blockedUsers: number;
  };
  funnel: Array<{ key: string; count: number }>;
  series: Array<{ day: string; events: number; registrations: number; moderationFlags: number }>;
  topButtons: Array<{ eventName: string; count: number }>;
};

type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_until: string | null;
  created_at: string;
  last_post_at: string | null;
  open_flags: number;
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [userQ, setUserQ] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [assistantQ, setAssistantQ] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState<null | {
    summary: string;
    risks: string[];
    actions: string[];
    queries: string[];
  }>(null);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api<Overview>("/api/admin/overview"),
    refetchInterval: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", userQ],
    queryFn: () => api<{ items: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(userQ)}`),
  });

  const contentQuery = useQuery({
    queryKey: ["admin-search", searchQ],
    queryFn: () => api<{ messages: Array<any>; comments: Array<any> }>(`/api/admin/search?q=${encodeURIComponent(searchQ)}`),
    enabled: searchQ.trim().length >= 2,
  });

  const maxSeriesEvents = useMemo(() => {
    const values = overviewQuery.data?.series.map((x) => Math.max(x.events, x.registrations, x.moderationFlags)) ?? [1];
    return Math.max(...values, 1);
  }, [overviewQuery.data?.series]);

  async function toggleBlock(user: AdminUser, blocked: boolean) {
    try {
      await api("/api/admin/users/block", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          blocked,
          reason: blocked ? "Manual moderation by admin" : undefined,
          days: blocked ? 30 : undefined,
        }),
      });
      toast.success(blocked ? "Пользователь заблокирован" : "Пользователь разблокирован");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка модерации");
    }
  }

  async function askAssistant() {
    if (assistantQ.trim().length < 3) {
      toast.error("Напиши вопрос для ассистента");
      return;
    }

    try {
      const res = await api<{ summary: string; risks: string[]; actions: string[]; queries: string[] }>("/api/admin/assistant", {
        method: "POST",
        body: JSON.stringify({ question: assistantQ.trim() }),
      });
      setAssistantAnswer(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI не ответил");
    }
  }

  const k = overviewQuery.data?.kpis;

  return (
    <PageShell>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Admin Control Center</h1>
          <p className="text-xs text-muted">Продуктовые метрики, антифрод и модерация в одном месте</p>
        </div>
        <div className="rounded-2xl border border-[#52cc83]/40 bg-[#52cc83]/15 px-3 py-2 text-xs text-[#baf7d3]">LIVE</div>
      </div>

      {overviewQuery.isLoading ? <Skeleton className="mb-3 h-48 w-full rounded-3xl" /> : null}

      {k ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            ["Users", k.usersTotal],
            ["DAU", k.dau],
            ["WAU", k.wau],
            ["MAU", k.mau],
            ["Posts 7d", k.posts7d],
            ["Comments 7d", k.comments7d],
            ["Event joins 7d", k.eventJoins7d],
            ["Open flags", k.openFlags],
            ["Blocked", k.blockedUsers],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="text-xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Funnel (14d)</p>
          <div className="space-y-2">
            {(overviewQuery.data?.funnel ?? []).map((f) => {
              const max = Math.max(...(overviewQuery.data?.funnel ?? [{ count: 1 }]).map((x) => x.count), 1);
              const width = Math.max(6, Math.round((f.count / max) * 100));
              return (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{f.key}</span>
                    <span>{f.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,#52cc83,#7ad6ff)]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Activity Trend (14d)</p>
          <div className="space-y-2">
            {(overviewQuery.data?.series ?? []).map((d) => (
              <div key={d.day} className="grid grid-cols-[74px_1fr] items-center gap-2 text-xs">
                <span className="text-muted">{d.day.slice(5)}</span>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-[#52cc83]" style={{ width: `${Math.max(4, (d.events / maxSeriesEvents) * 100)}%` }} />
                  <div className="h-1.5 rounded-full bg-[#8eb8ff]" style={{ width: `${Math.max(4, (d.registrations / maxSeriesEvents) * 100)}%` }} />
                  <div className="h-1.5 rounded-full bg-[#ff9b9b]" style={{ width: `${Math.max(4, (d.moderationFlags / maxSeriesEvents) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Top Clicked Actions (30d)</p>
          <div className="space-y-2 text-xs">
            {(overviewQuery.data?.topButtons ?? []).map((b) => (
              <div key={b.eventName} className="flex items-center justify-between rounded-xl border border-border bg-black/10 px-3 py-2">
                <span className="text-muted">{b.eventName}</span>
                <span className="font-semibold">{b.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">AI Admin Assistant</p>
          <div className="flex gap-2">
            <Input
              value={assistantQ}
              onChange={(e) => setAssistantQ(e.target.value)}
              placeholder="Например: где провал в конверсии и какие 3 действия сделать сегодня?"
            />
            <Button onClick={askAssistant}><Sparkles className="mr-1 h-4 w-4" />Спросить</Button>
          </div>
          {assistantAnswer ? (
            <div className="space-y-2 rounded-2xl border border-border bg-black/10 p-3 text-sm">
              <p>{assistantAnswer.summary}</p>
              <p className="text-xs font-semibold">Риски:</p>
              {assistantAnswer.risks.map((x) => <p key={x} className="text-xs text-muted">• {x}</p>)}
              <p className="text-xs font-semibold">Действия:</p>
              {assistantAnswer.actions.map((x) => <p key={x} className="text-xs text-muted">• {x}</p>)}
              <p className="text-xs font-semibold">Поисковые запросы:</p>
              {assistantAnswer.queries.map((x) => <p key={x} className="text-xs text-muted">• {x}</p>)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">User Moderation</p>
          <Input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Поиск по имени или номеру" />
          {usersQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {(usersQuery.data?.items ?? []).map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
                  <p className="text-xs text-muted">{u.phone} · {u.role}</p>
                  <p className="text-xs text-muted">open flags: {u.open_flags}</p>
                </div>
                <div className="flex gap-2">
                  {!u.is_blocked ? (
                    <Button variant="secondary" size="sm" onClick={() => toggleBlock(u, true)}>
                      <ShieldAlert className="mr-1 h-4 w-4" /> Block
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => toggleBlock(u, false)}>Unblock</Button>
                  )}
                </div>
              </div>
              {u.is_blocked ? (
                <p className="text-xs text-[#ffb0b0]">blocked: {u.blocked_reason || "no reason"}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Content Search (messages/comments)</p>
          <div className="flex gap-2">
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Поиск: наркот, террор, взрыв..." />
            <Button variant="secondary"><Search className="h-4 w-4" /></Button>
          </div>

          {contentQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}

          {(contentQuery.data?.messages ?? []).length ? <p className="text-xs font-semibold">Messages</p> : null}
          {(contentQuery.data?.messages ?? []).map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-black/10 p-3 text-xs">
              <p className="text-muted">from {m.from_user_id} to {m.to_user_id ?? "-"}</p>
              <p>{m.content}</p>
            </div>
          ))}

          {(contentQuery.data?.comments ?? []).length ? <p className="text-xs font-semibold">Comments</p> : null}
          {(contentQuery.data?.comments ?? []).map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-black/10 p-3 text-xs">
              <p className="text-muted">user {c.user_id} · post {c.post_id}</p>
              <p>{c.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
