"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Users2 } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { PageShell } from "@/components/page-shell";
import { CreateEventSheet } from "@/components/events/create-event-sheet";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import { EventPosterCard } from "@/components/events/event-poster-card";
import { EventSocialCard } from "@/components/events/event-social-card";
import type { EventListItem } from "@/components/events/types";
import { ApiClientError, api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";

const FLOW_TABS = [
  { key: "all", label: "Все" },
  { key: "external", label: "Афиши" },
  { key: "community", label: "Идём вместе" },
] as const;

const CATEGORY_TABS = [
  { key: "all", label: "Все" },
  { key: "popular", label: "Популярное" },
  { key: "concerts", label: "Концерты" },
  { key: "sport", label: "Спорт" },
  { key: "quests", label: "Квесты" },
  { key: "community", label: "Комьюнити" },
] as const;

type FeedTab = (typeof FLOW_TABS)[number]["key"];
type CategoryTab = (typeof CATEGORY_TABS)[number]["key"];

type EventsResponse = {
  items: EventListItem[];
  meta: {
    feed: FeedTab;
    tab: CategoryTab;
    total: number;
    has_companion: boolean;
  };
};

function eventQueryPath(feed: FeedTab, tab: CategoryTab, search: string, city: string) {
  const q = new URLSearchParams();
  q.set("feed", feed);
  q.set("tab", tab);
  if (search.trim()) q.set("search", search.trim());
  if (city.trim()) q.set("city", city.trim());
  q.set("limit", "80");
  return `/api/events?${q.toString()}`;
}

export default function EventsPage() {
  const queryClient = useQueryClient();

  const [feedTab, setFeedTab] = useState<FeedTab>("all");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [companionId, setCompanionId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const queryKey = useMemo(() => ["events-v2", feedTab, categoryTab, search, city], [feedTab, categoryTab, search, city]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api<EventsResponse>(eventQueryPath(feedTab, categoryTab, search, city)),
    staleTime: 20_000,
  });

  async function joinEvent(eventId: string) {
    try {
      setJoiningId(eventId);
      setActionError(null);
      await api(`/api/events/${eventId}/join`, { method: "POST" });

      queryClient.setQueryData<EventsResponse | undefined>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === eventId && !item.joined
              ? { ...item, joined: true, going_count: item.going_count + 1 }
              : item,
          ),
        };
      });

      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : "Не удалось зарегистрироваться на событие";
      setActionError(message);
    } finally {
      setJoiningId(null);
    }
  }

  async function toggleCompanion(eventId: string) {
    try {
      setCompanionId(eventId);
      setActionError(null);
      const current = data?.items.find((item) => item.id === eventId);
      const next = !current?.looking_company;
      const res = await api<{ ok: boolean; active: boolean }>(`/api/events/${eventId}/companion`, {
        method: "POST",
        body: JSON.stringify({ active: next }),
      });

      queryClient.setQueryData<EventsResponse | undefined>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => {
            if (item.id !== eventId) return item;
            const before = item.looking_company;
            const delta = before === res.active ? 0 : res.active ? 1 : -1;
            return {
              ...item,
              looking_company: res.active,
              companion_count: Math.max(0, item.companion_count + delta),
            };
          }),
        };
      });

      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : "Не удалось обновить статус поиска компании";
      setActionError(message);
    } finally {
      setCompanionId(null);
    }
  }

  return (
    <PageShell>
      <TopBar
        title="События"
        subtitle="Афиши и комьюнити-сборы в одном потоке"
        right={
          <Button type="button" onClick={() => setSheetOpen(true)} className="h-10 px-3 text-xs">
            <Plus className="mr-1 h-4 w-4" />
            Добавить
          </Button>
        }
      />

      <Card className="relative mb-3 overflow-hidden bg-[rgb(var(--surface-1-rgb)/0.95)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.16),transparent_65%)] blur-2xl" />
          <div className="absolute -right-20 top-2 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.16),transparent_65%)] blur-2xl" />
        </div>
        <CardContent className="relative p-4">
          <p className="mb-2 inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1 text-[11px] font-semibold text-text2">
            <Sparkles className="h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" />
            Events hub
          </p>
          <h2 className="text-[1.1rem] font-semibold text-text">Найди событие и компанию в одном экране</h2>
          <p className="mt-1 text-sm text-text2">Фокус на карточках, быстрых фильтрах и действиях “Я иду / Ищу компанию”.</p>
          <div className="mt-3 signature-line" />
        </CardContent>
      </Card>

      <div className="mb-3">
        <SegmentedTabs
          value={feedTab}
          onChange={(next) => setFeedTab(next as FeedTab)}
          options={FLOW_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
          className="w-full"
        />
      </div>

      <section className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const active = categoryTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryTab(tab.key)}
              className={cn(
                "tap-press whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-[rgb(var(--teal-rgb)/0.34)] bg-[image:var(--grad-primary)] text-white shadow-[0_0_12px_rgb(var(--teal-rgb)/0.22)]"
                  : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text2 hover:text-text",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </section>

      <Card className="mb-4 bg-[rgb(var(--surface-1-rgb)/0.94)]">
        <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: название, описание, место"
            className="h-11 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 text-sm text-text placeholder:text-text3 focus:border-[rgb(var(--teal-rgb)/0.4)] focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Город"
              className="h-11 flex-1 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 text-sm text-text placeholder:text-text3 focus:border-[rgb(var(--teal-rgb)/0.4)] focus:outline-none"
            />
            <Button type="button" variant="secondary" onClick={() => refetch()} className="h-11 px-3 text-sm">
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {actionError ? (
        <div className="mb-3 rounded-xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
          {actionError}
        </div>
      ) : null}

      {error ? (
        <Card className="mb-3 border-[rgb(var(--danger-rgb)/0.26)] bg-[rgb(var(--danger-rgb)/0.06)]">
          <CardContent className="p-3 text-sm">
            <p className="font-semibold text-[rgb(var(--danger-rgb))]">Не удалось загрузить события</p>
            <p className="mt-1 text-xs text-text2">{error instanceof Error ? error.message : "Ошибка загрузки"}</p>
            <Button type="button" onClick={() => refetch()} className="mt-2 h-9 px-3 text-xs">
              Повторить
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-3">
          {data.items.map((event) =>
            event.source_kind === "community" ? (
              <EventSocialCard
                key={event.id}
                event={event}
                joining={joiningId === event.id}
                companionLoading={companionId === event.id}
                onJoin={joinEvent}
                onToggleCompanion={toggleCompanion}
              />
            ) : (
              <EventPosterCard
                key={event.id}
                event={event}
                joining={joiningId === event.id}
                onJoin={joinEvent}
              />
            ),
          )}
        </div>
      ) : (
        <Card className="bg-[rgb(var(--surface-1-rgb)/0.95)]">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--teal-rgb)/0.12)]">
              <Users2 className="h-5 w-5 text-[rgb(var(--teal-rgb))]" />
            </div>
            <h3 className="text-base font-semibold text-text">Событий пока нет</h3>
            <p className="mt-1 text-sm text-text2">Создай комьюнити-событие или сбрось фильтры, чтобы увидеть больше вариантов.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={() => setSheetOpen(true)}>
                Добавить событие
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFeedTab("all");
                  setCategoryTab("all");
                  setSearch("");
                  setCity("");
                }}
              >
                Сбросить фильтры
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-2 text-center text-[11px] text-text3">
        {isFetching && !isLoading ? "Обновляем события..." : `Найдено: ${data?.meta?.total ?? 0}`}
      </div>

      <CreateEventSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={async () => {
          setFeedTab("community");
          setCategoryTab("community");
          await queryClient.invalidateQueries({ queryKey: ["events-v2"] });
        }}
      />
    </PageShell>
  );
}
