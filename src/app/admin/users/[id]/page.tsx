"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Shield, UserX, UserCheck, MessageSquareWarning, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const userQ = useQuery({
    queryKey: ["admin-user-360", params.id],
    queryFn: () => api<any>(`/api/admin/user/${params.id}`),
  });

  async function act(action: string) {
    try {
      setBusy(action);
      const res = await api<{ user: any }>(`/api/admin/users/${params.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });

      queryClient.setQueryData<any>(["admin-user-360", params.id], (prev) =>
        prev ? { ...prev, user: { ...prev.user, ...res.user }, adminAudit: [{ id: crypto.randomUUID(), action, created_at: new Date().toISOString() }, ...(prev.adminAudit ?? [])] } : prev,
      );
      await userQ.refetch();
      toast.success("Готово");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (userQ.isLoading) return <div className="p-4"><Skeleton className="h-56 w-full" /></div>;
  if (!userQ.data?.user) return <div className="p-4 text-sm text-muted">Пользователь не найден</div>;

  const d = userQ.data;
  const u = d.user;

  return (
    <div className="min-h-screen p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.push("/admin")}><ArrowLeft className="mr-1 h-4 w-4" />Назад</Button>
        <h1 className="text-xl font-semibold">User 360</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{u.name} · {u.phone}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs border ${u.is_blocked ? "border-danger text-danger" : "border-border text-muted"}`}>{u.is_blocked ? "blocked" : "active"}</span>
            <span className={`rounded-full px-3 py-1 text-xs border ${u.shadow_banned ? "border-warning text-warning" : "border-border text-muted"}`}>{u.shadow_banned ? "shadowbanned" : "visible"}</span>
            <span className={`rounded-full px-3 py-1 text-xs border ${u.message_limited ? "border-warning text-warning" : "border-border text-muted"}`}>{u.message_limited ? "limited" : "messaging normal"}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">posts</p><p className="text-lg font-semibold">{d.summary.postsTotal}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">event views/joins</p><p className="text-lg font-semibold">{d.summary.eventViews}/{d.summary.eventJoins}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">connect sent/replied</p><p className="text-lg font-semibold">{d.summary.connectSent}/{d.summary.connectReplied}</p></div>
            <div className="rounded-xl border border-border bg-black/10 p-2"><p className="text-xs text-muted">endorsements</p><p className="text-lg font-semibold">{d.summary.endorsementsReceived}</p></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy!==null} onClick={() => act(u.message_limited ? "unlimit_messaging" : "limit_messaging")}><MessageSquareWarning className="mr-1 h-4 w-4" />{u.message_limited ? "Unlimit messaging" : "Limit messaging"}</Button>
            <Button size="sm" variant="secondary" disabled={busy!==null} onClick={() => act(u.shadow_banned ? "unshadowban" : "shadowban")}>{u.shadow_banned ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}{u.shadow_banned ? "Unshadowban" : "Shadowban"}</Button>
            <Button size="sm" variant={u.is_blocked ? "secondary" : "danger"} disabled={busy!==null} onClick={() => act(u.is_blocked ? "unblock" : "block")}>{u.is_blocked ? <UserCheck className="mr-1 h-4 w-4" /> : <UserX className="mr-1 h-4 w-4" />}{u.is_blocked ? "Unblock" : "Block"}</Button>
            <Button size="sm" disabled={busy!==null} onClick={() => act("mark_safe")}><Shield className="mr-1 h-4 w-4" />Mark safe</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activity Heatmap (30d)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 md:grid-cols-15 gap-1">
            {(d.heatmap ?? []).slice(0, 30).map((h: any) => (
              <div key={h.day} title={`${h.day}: ${h.value}`} className="h-6 rounded" style={{ background: `rgba(82,204,131,${Math.min(0.9, 0.1 + h.value / 20)})` }} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Timeline (latest 50)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(d.timeline ?? []).map((t: any) => (
            <div key={t.created_at + t.label} className="rounded-xl border border-border bg-black/10 p-2 text-xs">
              <p className="font-medium">{t.label}</p>
              <p className="text-muted">{new Date(t.created_at).toLocaleString("ru-RU")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

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
    </div>
  );
}
