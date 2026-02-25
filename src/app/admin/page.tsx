"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, Shield, Sparkles, Trash2, UserRoundX, UserRoundCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/admin-client";
import {
  aiInsightsResponseSchema,
  featureFlagsResponseSchema,
  funnelsResponseSchema,
  moderationQueueResponseSchema,
  overviewResponseSchema,
  retentionResponseSchema,
  userSearchResponseSchema,
} from "@/lib/admin-schemas";
import { api } from "@/lib/api-client";

function kpiLabel(key: string) {
  const map: Record<string, string> = {
    usersTotal: "Users",
    dau: "DAU",
    wau: "WAU",
    mau: "MAU",
    dauMau: "DAU/MAU",
    newUsers1d: "New users 1d",
    newUsers7d: "New users 7d",
    telegramVerifiedRate: "TG verified rate",
    registrationCompletedRate: "Registration completed",
    verifiedUsers: "Verified users",
    dailyDuo1d: "Daily duo 1d",
    dailyDuo7d: "Daily duo 7d",
    eventJoin1d: "Event joins 1d",
    eventJoin7d: "Event joins 7d",
    connectClicked: "Connect clicked",
    chatsStarted: "Chats started",
    reportsOpen: "Open reports",
    flagsOpen: "Open flags",
    blockedUsers: "Blocked users",
  };
  return map[key] ?? key;
}

type Section = "overview" | "funnels" | "retention" | "users" | "moderation" | "flags" | "assistant";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [segment, setSegment] = useState<"all" | "verified" | "new" | "active">("all");
  const [search, setSearch] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const [moderationReason, setModerationReason] = useState("Policy violation");

  const toISO = new Date().toISOString();
  const fromDate = useMemo(() => {
    const base = Date.now();
    const days = Number(dateRange.replace("d", ""));
    return new Date(base - days * 24 * 60 * 60 * 1000).toISOString();
  }, [dateRange]);

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview", fromDate, segment],
    queryFn: () =>
      adminApi(
        `/api/admin/metrics/overview?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toISO)}&segment=${segment}`,
        overviewResponseSchema,
      ),
    refetchInterval: 30000,
  });

  const funnelsQuery = useQuery({
    queryKey: ["admin", "funnels", fromDate, segment],
    queryFn: () =>
      adminApi(
        `/api/admin/metrics/funnels?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toISO)}&segment=${segment}`,
        funnelsResponseSchema,
      ),
  });

  const retentionQuery = useQuery({
    queryKey: ["admin", "retention", segment],
    queryFn: () =>
      adminApi(
        `/api/admin/metrics/retention?from=${encodeURIComponent(
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        )}&to=${encodeURIComponent(toISO)}&segment=${segment}`,
        retentionResponseSchema,
      ),
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", searchUsers],
    queryFn: () =>
      adminApi(`/api/admin/users/search?q=${encodeURIComponent(searchUsers)}&limit=40`, userSearchResponseSchema),
  });

  const userDetailsQuery = useQuery({
    queryKey: ["admin", "user", selectedUserId],
    queryFn: () => api<any>(`/api/admin/user/${selectedUserId}`),
    enabled: Boolean(selectedUserId),
  });

  const moderationQuery = useQuery({
    queryKey: ["admin", "moderation"],
    queryFn: () => adminApi("/api/admin/moderation/actions", moderationQueueResponseSchema),
  });

  const flagsQuery = useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: () => adminApi("/api/admin/feature-flags", featureFlagsResponseSchema),
  });

  async function runModerationAction(payload: {
    targetType: "user" | "post" | "event" | "comment" | "report" | "flag";
    targetId: string;
    action:
      | "mark_safe"
      | "remove_content"
      | "warn_user"
      | "temporary_ban"
      | "shadowban"
      | "block_user"
      | "unblock_user"
      | "resolve_report";
  }) {
    try {
      await api("/api/admin/moderation/actions", {
        method: "POST",
        body: JSON.stringify({ ...payload, reason: moderationReason }),
      });
      toast.success("Action applied");
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function toggleFlag(id: string, key: string, enabled: boolean, rollout: number, description: string | null) {
    try {
      await api("/api/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify({ id, key, enabled, rollout, scope: "global", description, payload: {} }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to update flag");
    }
  }

  async function askAI() {
    const q = aiQuestion.trim();
    if (q.length < 3) {
      toast.error("Напиши вопрос для AI");
      return;
    }

    setAiMessages((prev) => [...prev, { role: "user", text: q }]);
    setAiQuestion("");

    try {
      const data = await adminApi(
        "/api/admin/ai/insights",
        aiInsightsResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            question: q,
            context: {
              overview: overviewQuery.data?.overview,
              funnels: funnelsQuery.data?.steps,
              retention: retentionQuery.data?.cohorts,
            },
          }),
        },
      );

      const text = [
        data.summary,
        `Anomalies: ${data.anomalies.join(" | ")}`,
        `Causes: ${data.causes.join(" | ")}`,
        `Actions: ${data.actions.join(" | ")}`,
        `SQL: ${data.sql.join(" | ")}`,
      ].join("\n\n");

      setAiMessages((prev) => [...prev, { role: "assistant", text }]);
      setSection("assistant");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    }
  }

  const maxFunnel = Math.max(...(funnelsQuery.data?.steps.map((x) => x.count) ?? [1]), 1);

  return (
    <AdminShell
      section={section}
      onSectionChange={setSection}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      segment={segment}
      onSegmentChange={setSegment}
      onAskAI={askAI}
      search={search}
      onSearch={setSearch}
    >
      {section === "overview" ? (
        <>
          {Object.entries(overviewQuery.data?.overview ?? {}).map(([key, value], idx) => (
            <motion.div key={key} className="col-span-12 sm:col-span-6 xl:col-span-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02, duration: 0.25 }}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">{kpiLabel(key)}</p>
                  <p className="mt-2 text-2xl font-semibold">{typeof value === "number" ? value : String(value)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          <div className="col-span-12">
            <Card>
              <CardHeader>
                <CardTitle>Product Health Notes</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-black/10 p-3 text-sm">Track DAU/MAU and registration completion daily.</div>
                <div className="rounded-2xl border border-border bg-black/10 p-3 text-sm">Monitor reports + flags as leading risk signal.</div>
                <div className="rounded-2xl border border-border bg-black/10 p-3 text-sm">Compare Daily Duo and Event joins to detect engagement shift.</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {section === "funnels" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Core Funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(funnelsQuery.data?.steps ?? []).map((step) => {
                const width = Math.max(6, Math.round((step.count / maxFunnel) * 100));
                return (
                  <div key={step.step} className="rounded-2xl border border-border bg-black/10 p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{step.step}</span>
                      <span className="font-semibold">{step.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#52cc83,#6ec6ff)]" style={{ width: `${width}%` }} />
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-muted">
                      <span>Drop: {Math.round(step.drop * 100)}%</span>
                      <span>Conv from start: {Math.round(step.conversionFromStart * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "retention" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Retention Cohorts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[160px_repeat(4,minmax(0,1fr))] gap-2 pb-2 text-xs text-muted">
                  <p>Cohort week</p>
                  <p>Users</p>
                  <p>D1</p>
                  <p>D7</p>
                  <p>D30</p>
                </div>
                {(retentionQuery.data?.cohorts ?? []).map((row) => (
                  <div key={row.cohortWeek} className="grid grid-cols-[160px_repeat(4,minmax(0,1fr))] gap-2 rounded-xl border border-border bg-black/10 p-2 text-sm">
                    <p>{row.cohortWeek}</p>
                    <p>{row.cohortSize}</p>
                    <p>{Math.round(row.d1Rate * 100)}%</p>
                    <p>{Math.round(row.d7Rate * 100)}%</p>
                    <p>{Math.round(row.d30Rate * 100)}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "users" ? (
        <>
          <div className="col-span-12 xl:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>Users Explorer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={searchUsers} onChange={(e) => setSearchUsers(e.target.value)} placeholder="Search by name or phone" />
                <div className="space-y-2">
                  {(usersQuery.data?.items ?? []).map((u) => (
                    <button key={u.id} type="button" onClick={() => setSelectedUserId(u.id)} className="w-full rounded-xl border border-border bg-black/10 p-3 text-left hover:bg-black/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{u.name}</p>
                          <p className="text-xs text-muted">{u.phone} · role {u.role}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p>flags {u.openFlags}</p>
                          <p>reports {u.openReports}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 xl:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Quick moderation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea value={moderationReason} onChange={(e) => setModerationReason(e.target.value)} />
                {selectedUserId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => runModerationAction({ targetType: "user", targetId: selectedUserId, action: "warn_user" })}>Warn</Button>
                    <Button variant="secondary" onClick={() => runModerationAction({ targetType: "user", targetId: selectedUserId, action: "shadowban" })}>Shadowban</Button>
                    <Button variant="danger" onClick={() => runModerationAction({ targetType: "user", targetId: selectedUserId, action: "block_user" })}><UserRoundX className="mr-1 h-4 w-4" />Block</Button>
                    <Button onClick={() => runModerationAction({ targetType: "user", targetId: selectedUserId, action: "unblock_user" })}><UserRoundCheck className="mr-1 h-4 w-4" />Unblock</Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Select a user to execute actions.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {section === "moderation" ? (
        <>
          <div className="col-span-12 xl:col-span-6">
            <Card>
              <CardHeader><CardTitle>Reports Inbox</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(moderationQuery.data?.reports ?? []).map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-border bg-black/10 p-3">
                    <p className="text-sm font-semibold">{r.content_type} · {r.reason}</p>
                    <p className="text-xs text-muted">{new Date(r.created_at).toLocaleString("ru-RU")}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => runModerationAction({ targetType: "report", targetId: r.id, action: "resolve_report" })}>Resolve</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 xl:col-span-6">
            <Card>
              <CardHeader><CardTitle>Auto Flags</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(moderationQuery.data?.flags ?? []).map((f: any) => (
                  <div key={f.id} className="rounded-xl border border-border bg-black/10 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{f.content_type} · risk {f.risk_score}</p>
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    </div>
                    <p className="text-xs text-muted">{f.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => runModerationAction({ targetType: "flag", targetId: f.id, action: "resolve_report" })}>Mark reviewed</Button>
                      <Button size="sm" variant="danger" onClick={() => runModerationAction({ targetType: f.content_type, targetId: f.content_id, action: "remove_content" } as any)}>
                        <Trash2 className="mr-1 h-4 w-4" />Remove content
                      </Button>
                      <Button size="sm" onClick={() => runModerationAction({ targetType: f.content_type, targetId: f.content_id, action: "mark_safe" } as any)}>
                        Mark safe
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {section === "flags" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader><CardTitle>Feature Flags / Remote Config</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(flagsQuery.data?.flags ?? []).map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-black/10 p-3">
                  <div>
                    <p className="text-sm font-semibold">{f.key}</p>
                    <p className="text-xs text-muted">{f.description ?? "No description"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">rollout {f.rollout}%</span>
                    <Button size="sm" variant={f.enabled ? "secondary" : "default"} onClick={() => toggleFlag(f.id, f.key, !f.enabled, f.rollout, f.description)}>
                      {f.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === "assistant" ? (
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>AI Admin Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-2xl border border-border bg-black/10 p-3">
                {aiMessages.map((m, idx) => (
                  <motion.div key={`${m.role}-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-3 text-sm ${m.role === "assistant" ? "border-cyan/25 bg-[#132441]/55" : "border-border bg-black/20"}`}>
                    <p className="mb-1 text-xs text-muted">{m.role === "assistant" ? "AI" : "You"}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </motion.div>
                ))}
                {!aiMessages.length ? <p className="text-xs text-muted">Задай вопрос про метрики, аномалии, SQL или модерацию.</p> : null}
              </div>

              <div className="flex gap-2">
                <Input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Почему упала регистрация на этой неделе и что сделать?" />
                <Button onClick={askAI}><Sparkles className="mr-1 h-4 w-4" />Ask</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog open={Boolean(selectedUserId)} onOpenChange={(v) => !v && setSelectedUserId(null)}>
        <DialogHeader>
          <DialogTitle>User Explorer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted">{selectedUserId}</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
              <CardContent className="text-xs">
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(userDetailsQuery.data?.user ?? {}, null, 2)}</pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Moderation history</CardTitle></CardHeader>
              <CardContent className="text-xs">
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(userDetailsQuery.data?.moderation ?? {}, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent className="text-xs">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(userDetailsQuery.data?.activity ?? {}, null, 2)}</pre>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => selectedUserId && runModerationAction({ targetType: "user", targetId: selectedUserId, action: "block_user" })}><Shield className="mr-1 h-4 w-4" />Block</Button>
            <Button onClick={() => selectedUserId && runModerationAction({ targetType: "user", targetId: selectedUserId, action: "unblock_user" })}>Unblock</Button>
          </div>
        </div>
      </Dialog>
    </AdminShell>
  );
}
