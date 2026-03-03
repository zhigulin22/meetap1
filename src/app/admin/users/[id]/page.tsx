"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Shield, UserX, UserCheck, MessageSquareWarning, EyeOff, Eye, AlertTriangle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { roleHasPermission } from "@/lib/admin-rbac";

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const p = phone.replace(/\s+/g, "");
  if (p.length < 6) return p;
  return `${p.slice(0, 3)}***${p.slice(-2)}`;
}

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d">("30d");
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "safety" | "notes" | "audit">("overview");
  const [actionNote, setActionNote] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const accessQ = useQuery({
    queryKey: ["admin-access-v1"],
    queryFn: () => api<any>("/api/admin/access"),
  });

  const userQ = useQuery({
    queryKey: ["admin-user-360", params.id],
    queryFn: () => api<any>(`/api/admin/user/${params.id}`),
  });

  const supportQ = useQuery({
    queryKey: ["admin-user-support", params.id],
    queryFn: () => api<any>(`/api/admin/support/desk?user_id=${params.id}`),
  });

  const canManageUsers = roleHasPermission(accessQ.data?.role ?? "", "users.action");

  async function addInternalNote() {
    if (!noteDraft.trim()) return;
    try {
      await api("/api/admin/support/notes", {
        method: "POST",
        body: JSON.stringify({ user_id: params.id, text: noteDraft.trim() }),
      });
      setNoteDraft("");
      await supportQ.refetch();
      setActionNote({ kind: "success", text: "Internal note добавлена" });
    } catch (e) {
      setActionNote({ kind: "error", text: e instanceof Error ? e.message : "Не удалось добавить note" });
    }
  }

  async function act(action: string) {
    if (!canManageUsers) return;
    try {
      setBusy(action);
      const res = await api<{ user: any }>(`/api/admin/users/${params.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });

      queryClient.setQueryData<any>(["admin-user-360", params.id], (prev: any) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, ...res.user },
              adminAudit: [{ id: crypto.randomUUID(), action, created_at: new Date().toISOString() }, ...(prev.adminAudit ?? [])],
            }
          : prev,
      );
      await userQ.refetch();
      setActionNote({ kind: "success", text: "Состояние пользователя обновлено" });
      setJustUpdated(true);
      window.setTimeout(() => setJustUpdated(false), 2200);
    } catch (e) {
      setActionNote({ kind: "error", text: e instanceof Error ? e.message : "Action failed" });
    } finally {
      setBusy(null);
    }
  }

  if (userQ.isLoading) return <div className="p-4"><Skeleton className="h-56 w-full" /></div>;
  if (!userQ.data?.user) return <div className="p-4 text-sm text-muted">Пользователь не найден</div>;

  const d = userQ.data;
  const u = d.user;
  const visibleHeat = (d.heatmap ?? []).slice(0, period === "7d" ? 7 : 30);

  return (
    <div className="min-h-screen space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.push("/admin")}><ArrowLeft className="mr-1 h-4 w-4" />Назад</Button>
        <h1 className="text-xl font-semibold">User 360</h1>
      </div>

      <Card className={justUpdated ? "ring-1 ring-cyan/40" : undefined}>
        <CardHeader><CardTitle>{u.name} · {maskPhone(u.phone)} · {u.city ?? u.country ?? "—"}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs ${u.is_blocked ? "border-danger text-danger" : "border-border text-muted"}`}>{u.is_blocked ? "blocked" : "active"}</span>
            <span className={`rounded-full border px-3 py-1 text-xs ${u.shadow_banned ? "border-warning text-warning" : "border-border text-muted"}`}>{u.shadow_banned ? "shadowbanned" : "visible"}</span>
            <span className={`rounded-full border px-3 py-1 text-xs ${u.message_limited ? "border-warning text-warning" : "border-border text-muted"}`}>{u.message_limited ? "limited" : "messaging normal"}</span>
            <span className={`rounded-full border px-3 py-1 text-xs ${u.risk_status === "high" ? "border-danger text-danger" : u.risk_status === "medium" ? "border-warning text-warning" : "border-action text-action"}`}>risk {u.risk_score ?? 0} · {u.risk_status ?? "low"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">posts duo/video</p><p className="text-lg font-semibold">{d.summary.dailyDuoCount}/{d.summary.videoCount}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">event views/joins</p><p className="text-lg font-semibold">{d.summary.eventViews}/{d.summary.eventJoins}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">connect sent/replied</p><p className="text-lg font-semibold">{d.summary.connectSent}/{d.summary.connectReplied}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">continued D+1</p><p className="text-lg font-semibold">{d.summary.continuedD1}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">reports received</p><p className="text-lg font-semibold">{d.summary.reportsReceived}</p></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["overview", "activity", "safety", "notes", "audit"] as const).map((tab) => (
              <Button key={tab} size="sm" variant={activeTab === tab ? "default" : "secondary"} onClick={() => setActiveTab(tab)}>
                {tab}
              </Button>
            ))}
          </div>

          {actionNote ? (
            <div className={`rounded-xl border p-2 text-xs ${actionNote.kind === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-action/40 bg-action/10 text-action"}`}>
              {actionNote.text}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Profile completed: <strong>{String(u.profile_completed)}</strong> · interests: <strong>{Array.isArray(u.interests) ? u.interests.length : 0}</strong> · facts: <strong>{Array.isArray(u.facts) ? u.facts.length : 0}</strong></p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy !== null || !canManageUsers} onClick={() => act(u.message_limited ? "unlimit_messaging" : "limit_messaging")}>{busy === (u.message_limited ? "unlimit_messaging" : "limit_messaging") ? "Applying..." : <><MessageSquareWarning className="mr-1 h-4 w-4" />{u.message_limited ? "Unlimit messaging" : "Limit messaging"}</>}</Button>
              <Button size="sm" variant="secondary" disabled={busy !== null || !canManageUsers} onClick={() => act(u.shadow_banned ? "unshadowban" : "shadowban")}>{busy === (u.shadow_banned ? "unshadowban" : "shadowban") ? "Applying..." : <>{u.shadow_banned ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}{u.shadow_banned ? "Unshadowban" : "Shadowban"}</>}</Button>
              <Button size="sm" variant={u.is_blocked ? "secondary" : "danger"} disabled={busy !== null || !canManageUsers} onClick={() => act(u.is_blocked ? "unblock" : "block")}>{busy === (u.is_blocked ? "unblock" : "block") ? "Applying..." : <>{u.is_blocked ? <UserCheck className="mr-1 h-4 w-4" /> : <UserX className="mr-1 h-4 w-4" />}{u.is_blocked ? "Unblock" : "Block"}</>}</Button>
              <Button size="sm" disabled={busy !== null || !canManageUsers} onClick={() => act("mark_safe")}>{busy === "mark_safe" ? "Applying..." : <><Shield className="mr-1 h-4 w-4" />Mark safe</>}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "activity" ? (
        <>
          <Card>
            <CardHeader><CardTitle>Activity Heatmap ({period})</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant={period === "7d" ? "default" : "secondary"} onClick={() => setPeriod("7d")}>7d</Button>
                <Button size="sm" variant={period === "30d" ? "default" : "secondary"} onClick={() => setPeriod("30d")}>30d</Button>
              </div>
              <div className="grid grid-cols-7 gap-1 md:grid-cols-15">
                {visibleHeat.map((h: any) => (
                  <div key={h.day} title={`${h.day}: ${h.value}`} className="h-6 rounded" style={{ background: `rgb(var(--mint-rgb)/${Math.min(0.9, 0.1 + h.value / 20)})` }} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline (latest 200)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(d.timeline ?? []).map((t: any) => (
                <div key={`${t.created_at}-${t.label}`} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-muted">{new Date(t.created_at).toLocaleString("ru-RU")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activeTab === "safety" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Risk signals</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(d.risk?.signals ?? []).length ? (
                (d.risk.signals ?? []).map((sig: any) => (
                  <div key={sig.key} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
                    <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5 text-warning" />{sig.label}</p>
                    <p className="text-muted">severity {sig.severity} · value {sig.value}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted">Критичных сигналов нет.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Moderation history</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(d.moderation?.actions ?? []).length ? (
                d.moderation.actions.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
                    <p className="font-medium">{a.action}</p>
                    <p className="text-muted">{a.reason ?? "—"} · {new Date(a.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted">Решений модерации пока нет.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <Card>
          <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Добавь internal note" />
              <Button onClick={addInternalNote}><Save className="mr-1 h-4 w-4" />Add</Button>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-auto">
              {(supportQ.data?.notes ?? []).length ? (
                supportQ.data.notes.map((n: any) => (
                  <div key={n.id} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
                    <p className="font-medium">{n.text}</p>
                    <p className="text-muted">{n.author_role} · {new Date(n.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted">Заметок пока нет.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "audit" ? (
        <Card>
          <CardHeader><CardTitle>Admin Audit</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(d.adminAudit ?? []).map((a: any) => (
              <div key={a.id} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
                <p className="font-medium">{a.action}</p>
                <p className="text-muted">{new Date(a.created_at).toLocaleString("ru-RU")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
