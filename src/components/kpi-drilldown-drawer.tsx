"use client";

import { useEffect } from "react";
import { X, Loader2, ExternalLink, BellPlus, Wand2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/help-tip";
import { AdminEmptyState } from "@/components/admin-empty-state";

type DrilldownPoint = { ts: string; value: number };

type DrilldownPayload = {
  metric: string;
  source: "events" | "users" | "mixed";
  current_value: number;
  previous_value: number;
  delta: number;
  status: "OK" | "Low" | "No data" | string;
  total_count?: number;
  unique_users?: number;
  expected_event_names?: string[];
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
  breakdown_by_week?: Array<{ week_start: string; value: number }>;
  breakdown_by_month?: Array<{ month: string; value: number }>;
  best_day?: DrilldownPoint | null;
  worst_day?: DrilldownPoint | null;
  best_week?: DrilldownPoint | null;
  worst_week?: DrilldownPoint | null;
  best_month?: DrilldownPoint | null;
  worst_month?: DrilldownPoint | null;
  breakdown_by_demo_group: Array<{ demo_group: string; value: number }>;
  breakdown_by_city: Array<{ city: string; value: number }>;
  top_users: Array<{ user_id: string; value: number }>;
  top_events: Array<{ event_id: string; value: number }>;
  top_event_names_24h: Array<{ event_name: string; count: number }>;
  top_event_names_period?: Array<{ event_name: string; count: number }>;
};

function formatDelta(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function Extremum({ label, point }: { label: string; point: DrilldownPoint | null | undefined }) {
  return (
    <p className="text-xs text-muted">
      {label}: {point ? <strong className="text-text">{point.ts} · {point.value}</strong> : "—"}
    </p>
  );
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
  onCreateExperiment,
  onAutoMap,
  autoMapLoading,
  experimentLoading,
}: {
  open: boolean;
  metric: string | null;
  loading: boolean;
  data: DrilldownPayload | null;
  error: string | null;
  onClose: () => void;
  onOpenEvents: () => void;
  onCreateAlert: () => void;
  onCreateExperiment: () => void;
  onAutoMap: () => void;
  autoMapLoading: boolean;
  experimentLoading: boolean;
}) {
  const topPeriod = data?.top_event_names_period ?? [];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/55 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 transition-all ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className={`flex h-[100dvh] w-full flex-col border border-border bg-surface shadow-soft transition-transform md:h-[calc(100dvh-3rem)] md:max-w-5xl md:rounded-2xl ${
            open ? "scale-100" : "scale-[0.98]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Drilldown</p>
              <p className="font-display text-lg font-semibold text-text">{metric ?? "Метрика"}</p>
            </div>
            <Button variant="secondary" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {loading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка детализации...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>
            ) : null}

            {!loading && data ? (
              <div className="space-y-4 pb-6">
                <div className="rounded-2xl border border-border bg-surface2/70 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-text">{data.definition?.title ?? metric}</p>
                    {data.definition ? <HelpTip compact {...data.definition} /> : null}
                  </div>
                  <p className="mt-1 text-muted">{data.definition?.body ?? "Детализация метрики"}</p>
                  <p className="mt-2">
                    Текущее значение: <strong>{data.current_value}</strong>
                  </p>
                  <p>
                    Всего событий: <strong>{Number(data.total_count ?? 0)}</strong>
                  </p>
                  <p>
                    Уникальных пользователей: <strong>{Number(data.unique_users ?? 0)}</strong>
                  </p>
                  <p>
                    Δ к прошлому периоду: <strong>{formatDelta(data.delta)}</strong>
                  </p>
                  <p>
                    Источник: <strong>{data.source}</strong> · Статус: <strong>{data.status}</strong>
                  </p>
                  {data.expected_event_names?.length ? (
                    <p className="mt-2 text-xs text-muted">Ищем event_name: {data.expected_event_names.join(", ")}</p>
                  ) : null}
                </div>

                {data.status === "No data" ? (
                  <>
                    <AdminEmptyState
                      why={(data.reasons ?? []).join(" ") || "Нет событий для выбранной метрики"}
                      action="Проверь event_name в Events Stream и добавь auto-map"
                      where="Events Stream + Data Quality"
                      actionLabel="Открыть Events Stream"
                      onAction={onOpenEvents}
                    />
                    <section className="rounded-2xl border border-warning/40 bg-warning/10 p-3">
                      <p className="mb-2 text-sm font-medium text-warning">Top event_name за период</p>
                      <div className="max-h-40 space-y-1 overflow-auto text-xs">
                        {topPeriod.length ? (
                          topPeriod.map((r) => (
                            <p key={r.event_name} className="flex justify-between">
                              <span>{r.event_name}</span>
                              <strong>{r.count}</strong>
                            </p>
                          ))
                        ) : (
                          <p className="text-muted">Нет событий</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : null}

                <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-sm font-medium">Breakdown по дням</p>
                  <div className="max-h-40 space-y-1 overflow-auto text-xs">
                    {data.breakdown_by_day?.length ? (
                      data.breakdown_by_day.map((r) => (
                        <p key={r.day} className="flex justify-between">
                          <span>{r.day}</span>
                          <strong>{r.value}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="text-muted">Нет данных</p>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <Extremum label="Лучший день" point={data.best_day} />
                    <Extremum label="Худший день" point={data.worst_day} />
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                    <p className="mb-2 text-sm font-medium">По неделям</p>
                    <div className="max-h-36 space-y-1 overflow-auto text-xs">
                      {data.breakdown_by_week?.length ? (
                        data.breakdown_by_week.map((r) => (
                          <p key={r.week_start} className="flex justify-between">
                            <span>{r.week_start}</span>
                            <strong>{r.value}</strong>
                          </p>
                        ))
                      ) : (
                        <p className="text-muted">Нет данных</p>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <Extremum label="Лучшая неделя" point={data.best_week} />
                      <Extremum label="Худшая неделя" point={data.worst_week} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                    <p className="mb-2 text-sm font-medium">По месяцам</p>
                    <div className="max-h-36 space-y-1 overflow-auto text-xs">
                      {data.breakdown_by_month?.length ? (
                        data.breakdown_by_month.map((r) => (
                          <p key={r.month} className="flex justify-between">
                            <span>{r.month}</span>
                            <strong>{r.value}</strong>
                          </p>
                        ))
                      ) : (
                        <p className="text-muted">Нет данных</p>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <Extremum label="Лучший месяц" point={data.best_month} />
                      <Extremum label="Худший месяц" point={data.worst_month} />
                    </div>
                  </section>
                </div>

                <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-sm font-medium">Breakdown по demo_group</p>
                  <div className="max-h-32 space-y-1 overflow-auto text-xs">
                    {data.breakdown_by_demo_group?.length ? (
                      data.breakdown_by_demo_group.map((r) => (
                        <p key={r.demo_group} className="flex justify-between">
                          <span>{r.demo_group}</span>
                          <strong>{r.value}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="text-muted">Нет данных</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-sm font-medium">Top cities</p>
                  <div className="max-h-32 space-y-1 overflow-auto text-xs">
                    {data.breakdown_by_city?.length ? (
                      data.breakdown_by_city.map((r) => (
                        <p key={r.city} className="flex justify-between">
                          <span>{r.city}</span>
                          <strong>{r.value}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="text-muted">Недоступно</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-sm font-medium">Top entities</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-muted">Top users</p>
                      <div className="max-h-28 space-y-1 overflow-auto text-xs">
                        {data.top_users?.length ? (
                          data.top_users.map((r) => (
                            <p key={r.user_id} className="flex justify-between">
                              <span className="font-mono">{r.user_id.slice(0, 8)}</span>
                              <strong>{r.value}</strong>
                            </p>
                          ))
                        ) : (
                          <p className="text-muted">Нет данных</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted">Top events</p>
                      <div className="max-h-28 space-y-1 overflow-auto text-xs">
                        {data.top_events?.length ? (
                          data.top_events.map((r) => (
                            <p key={r.event_id} className="flex justify-between">
                              <span className="font-mono">{r.event_id.slice(0, 8)}</span>
                              <strong>{r.value}</strong>
                            </p>
                          ))
                        ) : (
                          <p className="text-muted">Нет данных</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-surface2/70 p-3">
                  <p className="mb-2 text-sm font-medium">Top event_name за 24ч</p>
                  <div className="max-h-32 space-y-1 overflow-auto text-xs">
                    {data.top_event_names_24h?.length ? (
                      data.top_event_names_24h.map((r) => (
                        <p key={r.event_name} className="flex justify-between">
                          <span>{r.event_name}</span>
                          <strong>{r.count}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="text-muted">Нет событий за 24ч</p>
                    )}
                  </div>
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={onOpenEvents} className="active:scale-[0.98] transition-transform">
                    <ExternalLink className="mr-1 h-4 w-4" />Открыть Events Stream
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onAutoMap}
                    disabled={autoMapLoading}
                    className="active:scale-[0.98] transition-transform"
                  >
                    {autoMapLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                    Auto-map event names
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onCreateExperiment}
                    disabled={experimentLoading}
                    className="active:scale-[0.98] transition-transform"
                  >
                    {experimentLoading ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="mr-1 h-4 w-4" />
                    )}
                    Создать эксперимент
                  </Button>
                  <Button onClick={onCreateAlert} className="active:scale-[0.98] transition-transform">
                    <BellPlus className="mr-1 h-4 w-4" />Создать алерт
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
