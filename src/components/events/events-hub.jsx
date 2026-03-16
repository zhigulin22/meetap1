"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, RefreshCcw, Search, SlidersHorizontal, Users2 } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EventPosterCard } from "@/components/events/event-poster-card";
import { EventSocialCard } from "@/components/events/event-social-card";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiClientError, api } from "@/lib/api-client";

const SNAPSHOT_KEY = "events_snapshot_v2";

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
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [lookingOnly, setLookingOnly] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    feed: "all",
    category: "popular",
    dateFilter: "all",
    city: "",
    search: "",
    freeOnly: false,
    lookingOnly: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const feedParam = params.get("feed");
    const categoryParam = params.get("category");
    const dateParam = params.get("date");
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
    setCity("");
    setSearch("");
    setFreeOnly(false);
    setLookingOnly(false);
  }

  function resetDraftFilters() {
    setDraftFilters({
      feed: "all",
      category: "popular",
      dateFilter: "all",
      city: "",
      search: "",
      freeOnly: false,
      lookingOnly: false,
    });
  }

  function applyDraftFilters() {
    setFeed(draftFilters.feed);
    setCategory(draftFilters.category);
    setDateFilter(draftFilters.dateFilter);
    setCity(draftFilters.city);
    setSearch(draftFilters.search);
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
      city,
      search,
      freeOnly,
      lookingOnly,
    });
  }, [filtersOpen, feed, category, dateFilter, city, search, freeOnly, lookingOnly]);

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
    if (city.trim()) chips.push({ label: "Город: " + city.trim(), onRemove: () => setCity("") });
    if (search.trim()) chips.push({ label: "Поиск: " + search.trim(), onRemove: () => setSearch("") });
    if (freeOnly) chips.push({ label: "Бесплатно", onRemove: () => setFreeOnly(false) });
    if (lookingOnly) chips.push({ label: "Ищу компанию", onRemove: () => setLookingOnly(false) });
    return chips;
  }, [feed, category, dateFilter, city, search, freeOnly, lookingOnly]);

  const cacheInfo = eventsQuery.data?.pages?.[0]?.cache;
  const staleInfo = cacheInfo?.mode === "stale" ? cacheInfo : null;
  const snapshotAgeMin = snapshot ? Math.max(1, Math.round((Date.now() - snapshot.timestamp) / 60000)) : null;

  return (
    <PageShell>
      <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.96)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">События</h1>
            <p className="text-sm text-text2">Афиша и социальный слой знакомств</p>
          </div>
          <Link href="/events/new" className="inline-flex">
            <Button>+ Добавить</Button>
          </Link>
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

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] p-3">
            <div>
              <p className="text-xs text-text3">Фильтры</p>
              <p className="text-xs text-text2">Категория, город, дата, стоимость</p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-4 py-2 text-xs font-semibold text-text transition active:scale-[0.98]"
            >
              <SlidersHorizontal className="h-4 w-4 text-[rgb(var(--violet-rgb))]" />
              Фильтры{activeFilters.length ? ` · ${activeFilters.length}` : ""}
            </button>
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
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.85)] px-3 py-1.5 text-text2 transition hover:text-text"
            >
              {chip.label}
              <span className="text-text3">×</span>
            </button>
          ))}
        </div>
      )}

      {staleInfo && (
        <div className="mb-3 rounded-2xl border border-border bg-[rgb(var(--surface-2-rgb)/0.6)] px-3 py-2 text-xs text-text2">
          Показаны последние доступные данные. Обновлено {new Date(staleInfo.at).toLocaleString("ru-RU")}.
        </div>
      )}

      {errorBanner && (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
          {errorBanner}
        </div>
      )}

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
          {snapshot && eventsQuery.isError && (
            <p className="mt-2 text-xs text-text3">Показан офлайн-снимок ({snapshotAgeMin} мин назад).</p>
          )}
        </div>
      )}

      {eventsQuery.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => eventsQuery.fetchNextPage()}
          disabled={eventsQuery.isFetchingNextPage}
        >
          {eventsQuery.isFetchingNextPage ? "Загружаем..." : "Показать ещё"}
        </Button>
      )}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} mobileFullscreen>
        <DialogHeader className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-4 py-3">
          <DialogTitle>Фильтры событий</DialogTitle>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-xs text-text2"
          >
            Закрыть
          </button>
        </DialogHeader>

        <div className="space-y-5 px-4 pb-6 pt-2">
          <div>
            <p className="text-xs text-text3">Поиск</p>
            <label className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] px-3 py-2 text-sm text-text2">
              <Search className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
              <Input
                value={draftFilters.search}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="название, место..."
                className="h-8 border-0 bg-transparent px-0 text-sm text-text focus-visible:ring-0"
              />
            </label>
          </div>

          <div>
            <p className="text-xs text-text3">Город</p>
            <label className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] px-3 py-2 text-sm text-text2">
              <MapPin className="h-4 w-4 text-[rgb(var(--teal-rgb))]" />
              <Input
                value={draftFilters.city}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Город"
                className="h-8 border-0 bg-transparent px-0 text-sm text-text focus-visible:ring-0"
              />
            </label>
          </div>

          <div>
            <p className="text-xs text-text3">Дата</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dateTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, dateFilter: tab.key }))}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                    draftFilters.dateFilter === tab.key
                      ? "border border-[rgb(var(--sky-rgb)/0.5)] bg-[rgb(var(--sky-rgb)/0.2)] text-white"
                      : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text2"
                  }`}
                >
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-text3">Категории</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, category: tab.key }))}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                    draftFilters.category === tab.key
                      ? "border border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] text-white shadow-[0_12px_24px_rgb(var(--violet-rgb)/0.18)]"
                      : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text2"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDraftFilters((prev) => ({ ...prev, freeOnly: !prev.freeOnly }))}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 font-semibold transition active:scale-[0.98] ${
                draftFilters.freeOnly
                  ? "border border-[rgb(var(--sky-rgb)/0.5)] bg-[rgb(var(--sky-rgb)/0.2)] text-white"
                  : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text2"
              }`}
            >
              Бесплатно
            </button>

            <button
              type="button"
              onClick={() => setDraftFilters((prev) => ({ ...prev, lookingOnly: !prev.lookingOnly }))}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 font-semibold transition active:scale-[0.98] ${
                draftFilters.lookingOnly
                  ? "border border-[rgb(var(--violet-rgb)/0.5)] bg-[rgb(var(--violet-rgb)/0.2)] text-white"
                  : "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] text-text2"
              }`}
            >
              <Users2 className="h-3.5 w-3.5" /> Ищу компанию
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-4 py-3">
          <button
            type="button"
            onClick={resetDraftFilters}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb))] px-4 py-2 text-xs font-semibold text-text2"
          >
            <RefreshCcw className="h-4 w-4" /> Сбросить
          </button>
          <button
            type="button"
            onClick={applyDraftFilters}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))] px-5 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgb(var(--violet-rgb)/0.2)]"
          >
            Применить
          </button>
        </div>
      </Dialog>
    </PageShell>
  );
}
