"use client";

import { X, Loader2, ExternalLink, BellPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/help-tip";
import { AdminEmptyState } from "@/components/admin-empty-state";

type DrilldownPayload = {
  metric: string;
  source: "events" | "users" | "mixed";
  current_value: number;
  previous_value: number;
  delta: number;
  status: "OK" | "Low" | "No data" | string;
  reasons: string[];
  definition?: {
    title: string;
    body: string;
    why: string;
    influence: string;
    normal: string;
    next: string;
  } | null;
  breakdown_by_day: Array<{ day: string; value: number }>;
  breakdown_by_demo_group: Array<{ demo_group: string; value: number }>;
  breakdown_by_city: Array<{ city: string; value: number }>;
  top_users: Array<{ user_id: string; value: number }>;
  top_events: Array<{ event_id: string; value: number }>;
  top_event_names_24h: Array<{ event_name: string; count: number }>;
};

function formatDelta(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function KpiDrilldownDrawer({
  open,
  metric,
  loading,
  data,
  error,
  onClose,
  onOpenEvents,
  onCreateAlert,
}: {
  open: boolean;
  metric: string | null;
  loading: boolean;
  data: DrilldownPayload | null;
  error: string | null;
  onClose: () => void;
  onOpenEvents: () => void;
  onCreateAlert: () => void;
}) {
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/45 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside className={`fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] border-l border-border bg-surface p-4 shadow-[0_0_80px_rgba(0,0,0,0.45)] transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Drilldown</p>
            <p className="font-display text-lg font-semibold text-text">{metric ?? "Метрика"}</p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка детализации...</div>
        ) : null}

        {error ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

        {!loading && data ? (
          <div className="space-y-4 overflow-y-auto pb-16">
            <div className="rounded-2xl border border-border bg-surface2/70 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-text">{data.definition?.title ?? metric}</p>
                {data.definition ? (
                  <HelpTip compact {...data.definition} />
                ) : null}
              </div>
              <p className="mt-1 text-muted">{data.definition?.body ?? "Детализация метрики"}</p>
              <p className="mt-2">Текущее значение: <strong>{data.current_value}</strong></p>
              <p>Δ к прошлому периоду: <strong>{formatDelta(data.delta)}</strong></p>
              <p>Источник: <strong>{data.source}</strong> · Статус: <strong>{data.status}</strong></p>
            </div>

            {data.status === "No data" ? (
              <AdminEmptyState
                why={(data.reasons ?? []).join(" ") || "Нет событий для выбранной метрики"}
                action="Запусти Traffic Generator или проверь event_name в Events Stream"
                where="Events Stream + Data Quality"
                actionLabel="Открыть Events Stream"
                onAction={onOpenEvents}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4">
              <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 text-sm font-medium">Breakdown по дням (30)</p>
                <div className="max-h-40 space-y-1 overflow-auto text-xs">
                  {data.breakdown_by_day?.length ? data.breakdown_by_day.map((r) => <p key={r.day} className="flex justify-between"><span>{r.day}</span><strong>{r.value}</strong></p>) : <p className="text-muted">Нет данных</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 text-sm font-medium">Breakdown по demo_group</p>
                <div className="max-h-32 space-y-1 overflow-auto text-xs">
                  {data.breakdown_by_demo_group?.length ? data.breakdown_by_demo_group.map((r) => <p key={r.demo_group} className="flex justify-between"><span>{r.demo_group}</span><strong>{r.value}</strong></p>) : <p className="text-muted">Нет данных</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 text-sm font-medium">Breakdown по городам</p>
                <div className="max-h-32 space-y-1 overflow-auto text-xs">
                  {data.breakdown_by_city?.length ? data.breakdown_by_city.map((r) => <p key={r.city} className="flex justify-between"><span>{r.city}</span><strong>{r.value}</strong></p>) : <p className="text-muted">Недоступно</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 text-sm font-medium">Top entities</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted">Top users</p>
                    <div className="max-h-28 space-y-1 overflow-auto text-xs">
                      {data.top_users?.length ? data.top_users.map((r) => <p key={r.user_id} className="flex justify-between"><span className="font-mono">{r.user_id.slice(0, 8)}</span><strong>{r.value}</strong></p>) : <p className="text-muted">Нет данных</p>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted">Top events</p>
                    <div className="max-h-28 space-y-1 overflow-auto text-xs">
                      {data.top_events?.length ? data.top_events.map((r) => <p key={r.event_id} className="flex justify-between"><span className="font-mono">{r.event_id.slice(0, 8)}</span><strong>{r.value}</strong></p>) : <p className="text-muted">Нет данных</p>}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                <p className="mb-2 text-sm font-medium">Top event_name за 24ч</p>
                <div className="max-h-32 space-y-1 overflow-auto text-xs">
                  {data.top_event_names_24h?.length ? data.top_event_names_24h.map((r) => <p key={r.event_name} className="flex justify-between"><span>{r.event_name}</span><strong>{r.count}</strong></p>) : <p className="text-muted">Нет событий за 24ч</p>}
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenEvents} className="active:scale-[0.98] transition-transform"><ExternalLink className="mr-1 h-4 w-4" />Открыть Events Stream</Button>
                <Button onClick={onCreateAlert} className="active:scale-[0.98] transition-transform"><BellPlus className="mr-1 h-4 w-4" />Создать алерт</Button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
