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
        subtitle="Афиши + комьюнити: найди куда пойти и с кем"
        right={
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-10 items-center gap-1 rounded-xl bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-3 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(76,112,255,0.4)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        }
      />

      <section className="relative mb-3 overflow-hidden rounded-[24px] border border-[rgba(83,108,176,0.36)] bg-[linear-gradient(135deg,#080d21,#110b2b)] p-4 shadow-[0_20px_42px_rgba(4,7,22,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(82,124,255,0.3),transparent_40%),radial-gradient(circle_at_84%_16%,rgba(139,92,246,0.28),transparent_38%)]" />
        <div className="relative">
          <p className="mb-1 inline-flex items-center gap-1 rounded-full border border-[rgba(130,152,224,0.44)] bg-[rgba(16,21,45,0.72)] px-2.5 py-1 text-[11px] font-medium text-[#d6e2ff]">
            <Sparkles className="h-3.5 w-3.5 text-[#84a6ff]" />
            Агентский режим событий
          </p>
          <h2 className="text-[1.15rem] font-semibold text-[#eef3ff]">Актуальные афиши и комьюнити-сборы в одном потоке</h2>
          <p className="mt-1 text-sm text-[#aab9dd]">Публикуй свою встречу через Telegram-модерацию и сразу собирай компанию.</p>
        </div>
      </section>

      <section className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FLOW_TABS.map((tab) => {
          const active = feedTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFeedTab(tab.key)}
              className={`tap-press whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-[rgba(116,137,255,0.62)] bg-[linear-gradient(135deg,rgba(70,102,245,0.34),rgba(105,74,250,0.34))] text-[#edf1ff] shadow-[0_0_16px_rgba(96,119,255,0.36)]"
                  : "border-[rgba(84,106,168,0.35)] bg-[rgba(10,16,36,0.9)] text-[#aebfe5] hover:text-[#d8e2ff]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </section>

      <section className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const active = categoryTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryTab(tab.key)}
              className={`tap-press whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-[rgba(116,137,255,0.62)] bg-[linear-gradient(135deg,rgba(71,111,255,0.3),rgba(129,68,255,0.3))] text-[#ecf1ff] shadow-[0_0_14px_rgba(96,119,255,0.34)]"
                  : "border-[rgba(84,106,168,0.32)] bg-[rgba(10,16,36,0.86)] text-[#9fb2dd]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </section>

      <section className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: название, описание, место"
          className="h-11 rounded-xl border border-[rgba(84,106,168,0.34)] bg-[rgba(9,15,35,0.86)] px-3 text-sm text-[#edf2ff] placeholder:text-[#7f95c5] focus:border-[rgba(111,145,255,0.65)] focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город"
            className="h-11 flex-1 rounded-xl border border-[rgba(84,106,168,0.34)] bg-[rgba(9,15,35,0.86)] px-3 text-sm text-[#edf2ff] placeholder:text-[#7f95c5] focus:border-[rgba(111,145,255,0.65)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => refetch()}
            className="h-11 rounded-xl border border-[rgba(114,137,214,0.42)] bg-[rgba(17,27,60,0.92)] px-3 text-sm font-medium text-[#d8e4ff] transition hover:border-[rgba(144,170,236,0.6)] hover:text-white active:scale-[0.98]"
          >
            Обновить
          </button>
        </div>
      </section>

      {actionError ? (
        <div className="mb-3 rounded-xl border border-[rgba(255,79,143,0.45)] bg-[rgba(255,79,143,0.12)] px-3 py-2 text-xs text-[#ffc0db]">
          {actionError}
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-xl border border-[rgba(255,79,143,0.45)] bg-[rgba(255,79,143,0.12)] p-3 text-sm text-[#ffd2e2]">
          <p className="font-semibold">Не удалось загрузить события</p>
          <p className="mt-1 text-xs text-[#ffd2e2]/80">{error instanceof Error ? error.message : "Ошибка загрузки"}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 h-9 rounded-lg bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-3 text-xs font-semibold text-white"
          >
            Повторить
          </button>
        </div>
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
        <div className="rounded-[22px] border border-[rgba(84,106,168,0.35)] bg-[linear-gradient(135deg,rgba(10,16,35,0.94),rgba(16,10,36,0.94))] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(118,143,224,0.4)] bg-[rgba(17,24,56,0.8)]">
            <Users2 className="h-5 w-5 text-[#8bacff]" />
          </div>
          <h3 className="text-base font-semibold text-[#edf2ff]">Событий пока нет</h3>
          <p className="mt-1 text-sm text-[#a9badd]">Запусти комьюнити-встречу или переключись на другой фильтр.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="h-10 rounded-xl bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-4 text-sm font-semibold text-white"
            >
              Добавить событие
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedTab("all");
                setCategoryTab("all");
                setSearch("");
                setCity("");
              }}
              className="h-10 rounded-xl border border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] px-4 text-sm font-medium text-[#d9e4ff]"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 text-center text-[11px] text-[#7f95c5]">
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
