"use client";

import { useEffect, useMemo, useState } from "react";
import { InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, RefreshCcw, Search, SlidersHorizontal, Users2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EventPosterCard } from "@/components/events/event-poster-card";
import { EventSocialCard } from "@/components/events/event-social-card";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import type { EventListItem } from "@/components/events/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, api } from "@/lib/api-client";

const SNAPSHOT_KEY = "events_snapshot_v2";

type EventsResponse = {
  items: EventListItem[];
  next_offset: number | null;
  cache?: { mode: "fresh" | "stale"; at: string };
};

type FeedTab = "all" | "external" | "community";

type CategoryTab = "popular" | "concerts" | "sports" | "arts" | "quests" | "other" | "community" | "all";

type DateFilter = "all" | "today" | "weekend";

const feedTabs: Array<{ key: FeedTab; label: string }> = [
  { key: "all", label: "Все" },
  { key: "external", label: "Афиши" },
  { key: "community", label: "Идём вместе" },
];

const categoryTabs: Array<{ key: CategoryTab; label: string }> = [
  { key: "popular", label: "Популярное" },
  { key: "concerts", label: "Концерты" },
  { key: "sports", label: "Спорт" },
  { key: "arts", label: "Искусство" },
  { key: "quests", label: "Квесты" },
  { key: "other", label: "Другое" },
];

const dateTabs: Array<{ key: DateFilter; label: string }> = [
  { key: "all", label: "Любая дата" },
  { key: "today", label: "Сегодня" },
  { key: "weekend", label: "Выходные" },
];

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [companionId, setCompanionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ items: EventListItem[]; ts: number } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [feed, setFeed] = useState<FeedTab>("all");
  const [category, setCategory] = useState<CategoryTab>("popular");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [lookingOnly, setLookingOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const feedParam = params.get("feed") as FeedTab | null;
    const categoryParam = params.get("category") as CategoryTab | null;
    const dateParam = params.get("date") as DateFilter | null;
    const cityParam = params.get("city");
    const qParam = params.get("q");
    const freeParam = params.get("free");
    const lookingParam = params.get("looking");

    if (feedParam && feedTabs.some((t) => t.key === feedParam)) setFeed(feedParam);
    if (categoryParam && [...categoryTabs.map((t) => t.key), "all"].includes(categoryParam)) setCategory(categoryParam);
    if (dateParam && dateTabs.some((t) => t.key === dateParam)) setDateFilter(dateParam);
    if (cityParam) setCity(cityParam);
    if (qParam) setSearch(qParam);
    if (freeParam === "1") setFreeOnly(true);
    if (lookingParam === "1") setLookingOnly(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (feed !== "all") params.set("feed", feed);
    if (category !== "popular") params.set("category", category);
    if (dateFilter !== "all") params.set("date", dateFilter);
    if (city.trim()) params.set("city", city.trim());
    if (search.trim()) params.set("q", search.trim());
    if (freeOnly) params.set("free", "1");
    if (lookingOnly) params.set("looking", "1");
    const query = params.toString();
    const url = query ? `?${query}` : "";
    window.history.replaceState(null, "", url);
  }, [feed, category, dateFilter, city, search, freeOnly, lookingOnly]);

  const queryKey = ["events", { feed, category, dateFilter, city, search, freeOnly, lookingOnly }];

  const eventsQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (feed !== "all") params.set("feed", feed);
      if (category !== "popular") params.set("category", category);
      if (dateFilter !== "all") params.set("date", dateFilter);
      if (city.trim()) params.set("city", city.trim());
      if (search.trim()) params.set("q", search.trim());
      if (freeOnly) params.set("free", "1");
      if (lookingOnly) params.set("looking", "1");
      params.set("limit", "20");
      params.set("offset", String(pageParam));

      const data = await api<EventsResponse>(`/api/events?${params.toString()}`);
      if (!data.items?.length && data.cache?.mode === "stale" && !snapshot) {
        setSnapshot({ items: data.items ?? [], ts: Date.now() });
      }

      if (data.items?.length) {
        const snapshotPayload = { items: data.items, ts: Date.now() };
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshotPayload));
      }

      return data;
    },
    getNextPageParam: (lastPage) => lastPage.next_offset ?? undefined,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!eventsQuery.isError) return;
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { items: EventListItem[]; ts: number };
      setSnapshot(parsed);
    } catch {
      setSnapshot(null);
    }
  }, [eventsQuery.isError]);

  const items = eventsQuery.data?.pages.flatMap((p) => p.items ?? []) ?? [];

  async function join(eventId: string) {
    const target = items.find((item) => item.id === eventId);
    if (!target) return;

    setJoiningId(eventId);
    setErrorBanner(null);

    try {
      const res = await api<{ ok: boolean; joined: boolean }>(`/api/events/${eventId}/join`, {
        method: "POST",
        body: JSON.stringify({ joined: !target.joined }),
      });

      queryClient.setQueryData<InfiniteData<EventsResponse> | undefined>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === eventId
                ? { ...item, joined: res.joined, going_count: item.joined ? item.going_count - 1 : item.going_count + 1 }
                : item,
            ),
          })),
        };
      });
    } catch (error) {
      setErrorBanner(error instanceof ApiClientError ? error.message : "Не удалось зарегистрироваться");
    } finally {
      setJoiningId(null);
    }
  }

  async function toggleCompanion(eventId: string) {
    const target = items.find((item) => item.id === eventId);
    if (!target) return;

    setCompanionId(eventId);
    setErrorBanner(null);

    try {
      const res = await api<{ ok: boolean; active: boolean }>(`/api/events/${eventId}/companion`, {
        method: "POST",
        body: JSON.stringify({ active: !target.looking_company }),
      });

      queryClient.setQueryData<InfiniteData<EventsResponse> | undefined>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item.id !== eventId) return item;
              const delta = item.looking_company === res.active ? 0 : res.active ? 1 : -1;
              return {
                ...item,
                looking_company: res.active,
                companion_count: Math.max(0, item.companion_count + delta),
              };
            }),
          })),
        };
      });
    } catch (error) {
      setErrorBanner(error instanceof ApiClientError ? error.message : "Не удалось обновить поиск компании");
    } finally {
      setCompanionId(null);
    }
  }

  function resetFilters() {
    setFeed("all");
    setCategory("popular");
    setDateFilter("all");
    setCity("");
    setSearch("");
    setFreeOnly(false);
    setLookingOnly(false);
  }

  const activeFilters = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (feed !== "all") chips.push({ label: "Источник: " + (feed === "external" ? "Афиши" : "Идём вместе"), onRemove: () => setFeed("all") });
    if (category !== "popular") chips.push({ label: "Категория: " + (categoryTabs.find((t) => t.key === category)?.label ?? category), onRemove: () => setCategory("popular") });
    if (dateFilter !== "all") chips.push({ label: "Дата: " + (dateFilter === "today" ? "Сегодня" : "Выходные"), onRemove: () => setDateFilter("all") });
    if (city.trim()) chips.push({ label: "Город: " + city.trim(), onRemove: () => setCity("") });
    if (search.trim()) chips.push({ label: "Поиск: " + search.trim(), onRemove: () => setSearch("") });
    if (freeOnly) chips.push({ label: "Бесплатно", onRemove: () => setFreeOnly(false) });
    if (lookingOnly) chips.push({ label: "Ищу компанию", onRemove: () => setLookingOnly(false) });
    return chips;
  }, [feed, category, dateFilter, city, search, freeOnly, lookingOnly]);

  const cacheInfo = eventsQuery.data?.pages?.[0]?.cache;
  const staleInfo = cacheInfo?.mode === "stale" ? cacheInfo : null;
  const snapshotAgeMin = snapshot ? Math.max(1, Math.round((Date.now() - snapshot.ts) / 60000)) : null;

  return (
    <PageShell>
      <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.96)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">События</h1>
            <p className="text-sm text-text2">Афиша и социальный слой знакомств</p>
          </div>
          <Link href="/events/new" className="inline-flex"><Button>+ Добавить</Button></Link>
        </div>

        <div className="grid gap-3">
          <div>
            <p className="text-xs text-text3">Режим</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {feedTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFeed(tab.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                    feed === tab.key
                      ? "bg-[linear-gradient(135deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))] text-white shadow-[0_10px_24px_rgb(var(--violet-rgb)/0.2)]"
                      : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] text-text2"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] p-3">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
              <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-sm text-text2">
                <Search className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="название, место..."
                  className="h-8 border-0 bg-transparent px-0 text-sm text-text focus-visible:ring-0"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-sm text-text2">
                <MapPin className="h-4 w-4 text-[rgb(var(--teal-rgb))]" />
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Город"
                  className="h-8 border-0 bg-transparent px-0 text-sm text-text focus-visible:ring-0"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {dateTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDateFilter(tab.key)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                      dateFilter === tab.key
                        ? "border border-[rgb(var(--sky-rgb)/0.5)] bg-[rgb(var(--sky-rgb)/0.2)] text-white"
                        : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text2"
                    }`}
                  >
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs text-text3">Категории</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCategory(tab.key)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                      category === tab.key
                        ? "border border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] text-white shadow-[0_12px_24px_rgb(var(--violet-rgb)/0.18)]"
                        : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text2"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFreeOnly((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 font-semibold transition active:scale-[0.98] ${
                  freeOnly
                    ? "border border-[rgb(var(--sky-rgb)/0.5)] bg-[rgb(var(--sky-rgb)/0.2)] text-white"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text2"
                }`}
              >
                Бесплатно
              </button>

              <button
                type="button"
                onClick={() => setLookingOnly((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 font-semibold transition active:scale-[0.98] ${
                  lookingOnly
                    ? "border border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] text-white"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text2"
                }`}
              >
                <Users2 className="h-3.5 w-3.5" /> Ищу компанию
              </button>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 font-semibold text-text2 transition active:scale-[0.98]"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Сбросить
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeFilters.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text3">Активные фильтры:</span>
          {activeFilters.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] px-3 py-1.5 text-text2 transition hover:text-text"
            >
              {chip.label}
              <span className="text-text3">×</span>
            </button>
          ))}
        </div>
      ) : null}

      {staleInfo ? (
        <div className="mb-3 rounded-2xl border border-border bg-[rgb(var(--surface-2-rgb)/0.6)] px-3 py-2 text-xs text-text2">
          Показаны последние доступные данные. Обновлено {new Date(staleInfo.at).toLocaleString("ru-RU")}.
        </div>
      ) : null}

      {errorBanner ? (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
          {errorBanner}
        </div>
      ) : null}

      {!eventsQuery.isLoading && eventsQuery.isError && !items.length ? (
        <div className="rounded-2xl border border-border bg-[rgb(var(--surface-2-rgb)/0.6)] px-3 py-3 text-sm">
          <p className="text-sm">Не удалось загрузить события.</p>
          <p className="text-xs text-text2">Проверь соединение и попробуй снова.</p>
          <Button className="mt-2" onClick={() => eventsQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {eventsQuery.isLoading && !items.length ? (
        <div className="space-y-3">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      ) : items.length ? (
        <div className="space-y-4">
          {items.map((event) =>
            event.source_kind === "community" ? (
              <EventSocialCard
                key={event.id}
                event={event}
                joining={joiningId === event.id}
                companionLoading={companionId === event.id}
                onJoin={join}
                onToggleCompanion={toggleCompanion}
              />
            ) : (
              <EventPosterCard key={event.id} event={event} joining={joiningId === event.id} onJoin={join} />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-6 text-center">
          <p className="text-lg font-semibold text-text">Событий нет по фильтрам</p>
          <p className="mt-1 text-sm text-text2">Попробуй изменить фильтры или обновить список.</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={resetFilters}>Сбросить фильтры</Button>
            <Button variant="secondary" onClick={() => eventsQuery.refetch()}>
              Обновить
            </Button>
          </div>
          {snapshot && eventsQuery.isError ? (
            <p className="mt-2 text-xs text-text3">Показан офлайн-снимок ({snapshotAgeMin} мин назад).</p>
          ) : null}
        </div>
      ) : null}

      {eventsQuery.hasNextPage ? (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => eventsQuery.fetchNextPage()}
          disabled={eventsQuery.isFetchingNextPage}
        >
          {eventsQuery.isFetchingNextPage ? "Загружаем..." : "Показать ещё"}
        </Button>
      ) : null}
    </PageShell>
  );
}
