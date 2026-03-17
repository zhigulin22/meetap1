"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, RefreshCcw, SlidersHorizontal, Users2 } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EventPosterCard } from "@/components/events/event-poster-card";
import { EventSocialCard } from "@/components/events/event-social-card";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiClientError, api } from "@/lib/api-client";

const SNAPSHOT_KEY = "events_snapshot_v2";
const DEFAULT_CITY = "Москва";

const feedTabs = [
  { key: "all", label: "Все" },
  { key: "external", label: "Афиши" },
  { key: "community", label: "Идём вместе" },
];

const categoryTabs = [
  { key: "popular", label: "Популярное" },
  { key: "concerts", label: "Концерты" },
  { key: "sports", label: "Спорт" },
  { key: "arts", label: "Искусство" },
  { key: "quests", label: "Квесты" },
  { key: "other", label: "Другое" },
];


const dateTabs = [
  { key: "all", label: "Любая дата" },
  { key: "today", label: "Сегодня" },
  { key: "weekend", label: "Выходные" },
];

export default function EventsHub() {
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState(null);
  const [companionId, setCompanionId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [feed, setFeed] = useState("all");
  const [category, setCategory] = useState("popular");
  const [dateFilter, setDateFilter] = useState("all");
  const city = DEFAULT_CITY;
  const [freeOnly, setFreeOnly] = useState(false);
  const [lookingOnly, setLookingOnly] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    feed: "all",
    category: "popular",
    dateFilter: "all",
    freeOnly: false,
    lookingOnly: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const feedParam = params.get("feed");
    const categoryParam = params.get("category");
    const dateParam = params.get("date");
    const freeParam = params.get("free");
    const lookingParam = params.get("looking");

    if (feedParam && feedTabs.some((t) => t.key === feedParam)) setFeed(feedParam);
    if (categoryParam && [...categoryTabs.map((t) => t.key), "all"].includes(categoryParam)) setCategory(categoryParam);
    if (dateParam && dateTabs.some((t) => t.key === dateParam)) setDateFilter(dateParam);
    if (freeParam === "1") setFreeOnly(true);
    if (lookingParam === "1") setLookingOnly(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (feed !== "all") params.set("feed", feed);
    if (category !== "popular") params.set("category", category);
    if (dateFilter !== "all") params.set("date", dateFilter);
    if (freeOnly) params.set("free", "1");
    if (lookingOnly) params.set("looking", "1");
    const query = params.toString();
    const url = query ? `?${query}` : "";
    window.history.replaceState(null, "", url);
  }, [feed, category, dateFilter, freeOnly, lookingOnly]);

  const queryKey = ["events", { feed, category, dateFilter, freeOnly, lookingOnly }];

  const eventsQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (feed !== "all") params.set("feed", feed);
      if (category !== "popular") params.set("category", category);
      if (dateFilter !== "all") params.set("date", dateFilter);
      params.set("city", DEFAULT_CITY);
      if (freeOnly) params.set("free", "1");
      if (lookingOnly) params.set("looking", "1");
      params.set("limit", "20");
      params.set("offset", String(pageParam));

      const data = await api(`/api/events?${params.toString()}`);
      if (!data.items?.length && data.cache?.mode === "stale" && !snapshot) {
        setSnapshot({ items: data.items ?? [], timestamp: Date.now() });
      }

      if (data.items?.length) {
        const snapshotPayload = { items: data.items, timestamp: Date.now() };
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
      const parsed = JSON.parse(raw);
      setSnapshot(parsed);
    } catch {
      setSnapshot(null);
    }
  }, [eventsQuery.isError]);

  const items = eventsQuery.data?.pages.flatMap((p) => p.items ?? []) ?? [];

  const stats = useMemo(() => {
    const total = items.length;
    const free = items.filter((i) => !i.is_paid || i.price <= 0).length;
    const community = items.filter((i) => i.source_kind === "community").length;
    return { total, free, community };
  }, [items]);

  async function join(eventId) {
    const target = items.find((item) => item.id === eventId);
    if (!target) return;

    setJoiningId(eventId);
    setErrorBanner(null);

    try {
      const res = await api(`/api/events/${eventId}/join`, {
        method: "POST",
        body: JSON.stringify({ joined: !target.joined }),
      });

      queryClient.setQueryData(queryKey, (prev) => {
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

  async function toggleCompanion(eventId) {
    const target = items.find((item) => item.id === eventId);
    if (!target) return;

    setCompanionId(eventId);
    setErrorBanner(null);

    try {
      const res = await api(`/api/events/${eventId}/companion`, {
        method: "POST",
        body: JSON.stringify({ active: !target.looking_company }),
      });

      queryClient.setQueryData(queryKey, (prev) => {
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
    setFreeOnly(false);
    setLookingOnly(false);
  }

  function resetDraftFilters() {
    setDraftFilters({
      feed: "all",
      category: "popular",
      dateFilter: "all",
      freeOnly: false,
      lookingOnly: false,
    });
  }

  function applyDraftFilters() {
    setFeed(draftFilters.feed);
    setCategory(draftFilters.category);
    setDateFilter(draftFilters.dateFilter);
    setFreeOnly(draftFilters.freeOnly);
    setLookingOnly(draftFilters.lookingOnly);
    setFiltersOpen(false);
  }

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftFilters({
      feed,
      category,
      dateFilter,
      freeOnly,
      lookingOnly,
    });
  }, [filtersOpen, feed, category, dateFilter, freeOnly, lookingOnly]);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (feed !== "all") {
      chips.push({ label: "Источник: " + (feed === "external" ? "Афиши" : "Идём вместе"), onRemove: () => setFeed("all") });
    }
    if (category !== "popular") {
      chips.push({
        label: "Категория: " + (categoryTabs.find((t) => t.key === category)?.label ?? category),
        onRemove: () => setCategory("popular"),
      });
    }
    if (dateFilter !== "all") {
      chips.push({ label: "Дата: " + (dateFilter === "today" ? "Сегодня" : "Выходные"), onRemove: () => setDateFilter("all") });
    }
    if (freeOnly) chips.push({ label: "Бесплатно", onRemove: () => setFreeOnly(false) });
    if (lookingOnly) chips.push({ label: "Ищу компанию", onRemove: () => setLookingOnly(false) });
    return chips;
  }, [feed, category, dateFilter, freeOnly, lookingOnly]);

  const cacheInfo = eventsQuery.data?.pages?.[0]?.cache;
  const staleInfo = cacheInfo?.mode === "stale" ? cacheInfo : null;
  const snapshotAgeMin = snapshot ? Math.max(1, Math.round((Date.now() - snapshot.timestamp) / 60000)) : null;

  return (
    <PageShell>
      <div className="mb-6 rounded-[32px] border border-[color:var(--border-strong)] bg-[linear-gradient(160deg,rgba(18,26,50,0.98),rgba(18,26,50,0.7))] p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">События</h1>
            <p className="text-sm text-text2">Афиша и социальный слой знакомств · Москва</p>
          </div>
          <Link href="/events/new" className="inline-flex">
            <Button className="h-12 rounded-full px-7">+ Добавить</Button>
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-4">
            <p className="text-xs text-text3">Всего событий</p>
            <p className="mt-2 text-2xl font-semibold text-text">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-4">
            <p className="text-xs text-text3">Бесплатно</p>
            <p className="mt-2 text-2xl font-semibold text-text">{stats.free}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.85)] p-4">
            <p className="text-xs text-text3">Комьюнити</p>
            <p className="mt-2 text-2xl font-semibold text-text">{stats.community}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text3">Режим</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {feedTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFeed(tab.key)}
                className={`h-12 rounded-full px-6 text-sm font-semibold transition active:scale-[0.98] ${
                  feed === tab.key
                    ? "bg-[image:var(--grad-primary)] text-white shadow-[0_12px_26px_rgba(122,84,255,0.4)]"
                    : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] text-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-text2">Фильтры: категории, дата, бесплатно, поиск компании</div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[image:var(--grad-primary)] px-6 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(122,84,255,0.4)] transition active:scale-[0.98]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Фильтры{activeFilters.length ? " · " + activeFilters.length : ""}
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] px-5 text-sm font-semibold text-text transition active:scale-[0.98]"
              >
                <RefreshCcw className="h-4 w-4" /> Сбросить
              </button>
            </div>
          </div>
        </div>
      </div>

{activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text3">Активные фильтры:</span>
          {activeFilters.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-3 py-1.5 text-text2 transition hover:text-text"
            >
              {chip.label}
              <span className="text-text3">×</span>
            </button>
          ))}
        </div>
      )}

      {staleInfo && (
        <div className="mb-3 rounded-2xl border border-border bg-[rgb(var(--surface-2-rgb)/0.7)] px-3 py-2 text-xs text-text2">
          Показаны последние доступные данные. Обновлено {new Date(staleInfo.at).toLocaleString("ru-RU")}.
        </div>
      )}

      {errorBanner && (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
          {errorBanner}
        </div>
      )}

      {!eventsQuery.isLoading && eventsQuery.isError && !items.length ? (
        <div className="rounded-2xl border border-border bg-[rgb(var(--surface-2-rgb)/0.7)] px-3 py-3 text-sm">
          <p className="text-sm">Не удалось загрузить события.</p>
          <p className="text-xs text-text2">Проверь соединение и попробуй снова.</p>
          <Button className="mt-2" onClick={() => eventsQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {eventsQuery.isLoading && !items.length ? (
        <div className="space-y-4">
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
        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.95)] p-6 text-center">
          <p className="text-lg font-semibold text-text">Событий нет по фильтрам</p>
          <p className="mt-1 text-sm text-text2">Попробуй изменить фильтры или обновить список.</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={resetFilters}>Сбросить фильтры</Button>
            <Button variant="secondary" onClick={() => eventsQuery.refetch()}>
              Обновить
            </Button>
          </div>
          {snapshot && eventsQuery.isError && (
            <p className="mt-2 text-xs text-text3">Показан офлайн-снимок ({snapshotAgeMin} мин назад).</p>
          )}
        </div>
      )}

      {eventsQuery.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-5 w-full"
          onClick={() => eventsQuery.fetchNextPage()}
          disabled={eventsQuery.isFetchingNextPage}
        >
          {eventsQuery.isFetchingNextPage ? "Загружаем..." : "Показать ещё"}
        </Button>
      )}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} mobileFullscreen>
        <DialogHeader className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] px-4 py-3">
          <DialogTitle>Фильтры событий</DialogTitle>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm text-text"
          >
            Закрыть
          </button>
        </DialogHeader>

        <div className="space-y-5 px-4 pb-6 pt-2">
          <div>
            <p className="text-sm font-semibold text-text2">Дата</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {dateTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, dateFilter: tab.key }))}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                    draftFilters.dateFilter === tab.key
                      ? "bg-[image:var(--grad-primary)] text-white shadow-[0_12px_24px_rgba(122,84,255,0.3)]"
                      : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text"
                  }`}
                >
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text2">Категории</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, category: tab.key }))}
                  className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                    draftFilters.category === tab.key
                      ? "bg-[image:var(--grad-primary)] text-white shadow-[0_14px_26px_rgba(122,84,255,0.3)]"
                      : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setDraftFilters((prev) => ({ ...prev, freeOnly: !prev.freeOnly }))}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold transition active:scale-[0.98] ${
                draftFilters.freeOnly
                  ? "bg-[rgb(var(--sky-rgb)/0.35)] text-white border-[rgb(var(--sky-rgb)/0.6)]"
                  : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text"
              }`}
            >
              Бесплатно
            </button>

            <button
              type="button"
              onClick={() => setDraftFilters((prev) => ({ ...prev, lookingOnly: !prev.lookingOnly }))}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold transition active:scale-[0.98] ${
                draftFilters.lookingOnly
                  ? "bg-[rgb(var(--violet-rgb)/0.35)] text-white border-[rgb(var(--violet-rgb)/0.6)]"
                  : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text"
              }`}
            >
              <Users2 className="h-3.5 w-3.5" /> Ищу компанию
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] px-4 py-3">
          <button
            type="button"
            onClick={resetDraftFilters}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-5 py-2.5 text-sm font-semibold text-text"
          >
            <RefreshCcw className="h-4 w-4" /> Сбросить
          </button>
          <button
            type="button"
            onClick={applyDraftFilters}
            className="inline-flex items-center gap-2 rounded-full bg-[image:var(--grad-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(122,84,255,0.35)]"
          >
            Применить
          </button>
        </div>
      </Dialog>
    </PageShell>
  );
}
