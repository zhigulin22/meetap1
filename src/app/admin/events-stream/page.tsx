"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/admin-client";
import { liveEventsResponseSchema } from "@/lib/admin-schemas";
import { api } from "@/lib/api-client";

export default function AdminEventsStreamPage() {
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [demoGroup, setDemoGroup] = useState("traffic");

  const stream = useQuery({
    queryKey: ["admin-events-stream-page", eventName, userId, demoGroup],
    queryFn: () =>
      adminApi(
        "/api/admin/events/live?event_name=" +
          encodeURIComponent(eventName) +
          "&user_id=" +
          encodeURIComponent(userId) +
          "&demo_group=" +
          encodeURIComponent(demoGroup) +
          "&limit=500",
        liveEventsResponseSchema,
      ),
    refetchInterval: 3000,
  });

  async function writeTestEvent() {
    await api("/api/admin/health/test-event", { method: "POST" });
    await stream.refetch();
  }

  async function copyEvent(item: unknown) {
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2));
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Events Stream</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="event_name" />
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user_id" />
            <Input value={demoGroup} onChange={(e) => setDemoGroup(e.target.value)} placeholder="demo_group" />
            <Button variant="secondary" onClick={() => stream.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Обновить
            </Button>
            <Button onClick={writeTestEvent}>Write test event</Button>
          </div>

          {stream.isLoading ? <Skeleton className="h-64 w-full" /> : null}

          {!stream.isLoading && !(stream.data?.items?.length ?? 0) ? (
            <div className="rounded-xl border border-border bg-surface2/70 p-4 text-sm text-muted">Нет событий по выбранным фильтрам.</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface2/70">
              <div className="grid min-w-[1120px] grid-cols-[220px_1fr_240px_1fr_80px] gap-2 border-b border-border/40 px-3 py-2 text-xs font-semibold text-muted">
                <span>created_at</span>
                <span>event_name</span>
                <span>user_id</span>
                <span>summary</span>
                <span></span>
              </div>
              {(stream.data?.items ?? []).map((item) => (
                <div key={item.id} className="grid min-w-[1120px] grid-cols-[220px_1fr_240px_1fr_80px] gap-2 border-b border-border/30 px-3 py-2 text-xs last:border-b-0">
                  <span>{new Date(item.created_at).toLocaleString("ru-RU")}</span>
                  <span className="font-medium text-text">{item.event_name}</span>
                  <span className="truncate text-muted">{item.user_id ?? "-"}</span>
                  <span className="truncate text-muted">{item.summary ?? "-"}</span>
                  <Button size="sm" variant="secondary" onClick={() => copyEvent(item)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
