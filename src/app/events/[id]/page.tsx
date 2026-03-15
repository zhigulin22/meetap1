"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, MapPin, MessageCircleHeart, Users2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ApiClientError, api } from "@/lib/api-client";
import type { EventListItem } from "@/components/events/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EventParticipantRow = {
  user_id: string;
  users:
    | { id: string; name: string; avatar_url: string | null; interests?: string[] }
    | Array<{ id: string; name: string; avatar_url: string | null; interests?: string[] }>
    | null;
};

type EventDetailResponse = {
  event: EventListItem;
  participants: EventParticipantRow[];
  joined: boolean;
  going_count: number;
  companion_count: number;
  looking_company: boolean;
  is_owner: boolean;
};

function formatDate(dateISO: string) {
  const date = new Date(dateISO);
  if (!Number.isFinite(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function socialModeLabel(mode: string) {
  if (mode === "looking_company") return "Ищу компанию";
  if (mode === "collect_group") return "Собираю группу";
  return "Организую событие";
}

function mapParticipants(rows: EventParticipantRow[]) {
  return rows
    .map((row) => (Array.isArray(row.users) ? row.users[0] : row.users))
    .filter((u): u is { id: string; name: string; avatar_url: string | null; interests?: string[] } => Boolean(u?.id));
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [participantSearch, setParticipantSearch] = useState("");
  const [joining, setJoining] = useState(false);
  const [companionLoading, setCompanionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["event", params.id],
    queryFn: () => api<EventDetailResponse>(`/api/events/${params.id}`),
    staleTime: 20_000,
  });

  const participants = useMemo(() => mapParticipants(data?.participants ?? []), [data?.participants]);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((person) => person.name?.toLowerCase().includes(q));
  }, [participantSearch, participants]);

  async function joinEvent() {
    if (!params.id) return;
    try {
      setJoining(true);
      setErrorBanner(null);
      await api(`/api/events/${params.id}/join`, { method: "POST" });
      queryClient.setQueryData<EventDetailResponse | undefined>(["event", params.id], (prev) =>
        prev
          ? {
              ...prev,
              joined: true,
              going_count: prev.joined ? prev.going_count : prev.going_count + 1,
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["events-v3"] });
    } catch (e) {
      setErrorBanner(e instanceof ApiClientError ? e.message : "Не удалось зарегистрироваться");
    } finally {
      setJoining(false);
    }
  }

  async function toggleCompanion() {
    if (!params.id || !data) return;
    try {
      setCompanionLoading(true);
      setErrorBanner(null);
      const next = !data.looking_company;
      const res = await api<{ ok: boolean; active: boolean }>(`/api/events/${params.id}/companion`, {
        method: "POST",
        body: JSON.stringify({ active: next }),
      });

      queryClient.setQueryData<EventDetailResponse | undefined>(["event", params.id], (prev) => {
        if (!prev) return prev;
        const delta = prev.looking_company === res.active ? 0 : res.active ? 1 : -1;
        return {
          ...prev,
          looking_company: res.active,
          companion_count: Math.max(0, prev.companion_count + delta),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["events-v3"] });
    } catch (e) {
      setErrorBanner(e instanceof ApiClientError ? e.message : "Не удалось обновить поиск компании");
    } finally {
      setCompanionLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <PageShell>
        <Card className="overflow-hidden bg-[rgb(var(--surface-1-rgb)/0.95)]">
          <CardContent className="p-4">
            <div className="mb-3 h-56 animate-pulse rounded-2xl bg-[rgb(var(--surface-3-rgb)/0.64)]" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.64)]" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.58)]" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.58)]" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const event = data.event;

  return (
    <PageShell>
      <article className="dual-edge relative overflow-hidden rounded-[26px] bg-[rgb(var(--surface-1-rgb)/0.96)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 top-2 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.12),transparent_65%)] blur-2xl" />
          <div className="absolute -right-12 top-2 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.12),transparent_65%)] blur-2xl" />
        </div>

        <div className="relative overflow-hidden rounded-[25px]">
          <div className="relative">
            <Image
              src={event.cover_url || "https://placehold.co/1280x800/eff3ff/6b74b6?text=EVENT"}
              alt={event.title}
              width={1280}
              height={800}
              className="h-60 w-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.04),rgba(17,24,39,0.48))]" />

            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2.5 py-1 text-[11px] font-medium text-text">
              {event.source_kind === "community" ? "Комьюнити" : "Афиша"}
            </div>

            <div className="absolute bottom-4 left-3 right-3">
              <h1 className="text-2xl font-semibold leading-tight text-white">{event.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/20 px-2 py-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDate(event.starts_at)}
                </span>
                {event.city ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/20 px-2 py-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/20 px-2 py-1">
                  {event.category || "Событие"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {errorBanner ? (
              <div className="rounded-xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
                {errorBanner}
              </div>
            ) : null}

            {event.status && event.status !== "published" ? (
              <div className="rounded-xl border border-[rgb(var(--warning-rgb)/0.2)] bg-[rgb(var(--warning-rgb)/0.12)] px-3 py-2 text-xs text-[rgb(var(--warning-rgb))]">
                {event.status === "draft"
                  ? "Черновик. Событие видно только вам."
                  : event.status === "pending_review"
                    ? "На модерации. Скоро появится в “Идём вместе”."
                    : "Событие временно скрыто"}
              </div>
            ) : null}

            <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.66)] p-4">
              <p className="text-xs uppercase tracking-wide text-text3">О мероприятии</p>
              {event.short_description ? (
                <p className="mt-2 text-sm font-medium text-text">Кратко: {event.short_description}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text2">
                {event.full_description || event.short_description || "Описание скоро появится."}
              </p>
            </section>

            <section className="grid gap-2 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.66)] p-4">
                <p className="text-xs uppercase tracking-wide text-text3">Где и когда</p>
                <p className="mt-2 text-sm text-text">{formatDate(event.starts_at)}</p>
                {event.ends_at ? (
                  <p className="mt-1 text-xs text-text3">До {formatDate(event.ends_at)}</p>
                ) : null}
                {event.venue_name || event.venue_address ? (
                  <p className="mt-1 text-sm text-text2">{event.venue_name || event.venue_address}</p>
                ) : null}
                {event.city ? <p className="mt-1 text-sm text-text2">{event.city}</p> : null}
              </div>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.66)] p-4">
                <p className="text-xs uppercase tracking-wide text-text3">Стоимость и формат</p>
                <p className="mt-2 text-sm text-text">
                  {event.is_paid ? event.price_note || (event.price ? `от ${event.price} ₽` : "Платное") : "Бесплатно"}
                </p>
                {event.source_kind === "community" ? (
                  <p className="mt-1 text-sm text-text2">Формат: {socialModeLabel(event.social_mode)}</p>
                ) : null}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[rgb(var(--teal-rgb)/0.22)] bg-[rgb(var(--teal-rgb)/0.08)] p-3">
                <p className="text-xs text-text3">Идут</p>
                <p className="text-lg font-semibold text-text">{data.going_count}</p>
              </div>
              <div className="rounded-xl border border-[rgb(var(--sky-rgb)/0.22)] bg-[rgb(var(--sky-rgb)/0.08)] p-3">
                <p className="text-xs text-text3">Ищут компанию</p>
                <p className="text-lg font-semibold text-text">{data.companion_count}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {data.joined ? (
                <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgb(var(--teal-rgb)/0.32)] bg-[rgb(var(--teal-rgb)/0.14)] text-sm font-semibold text-text">
                  Вы идёте
                </span>
              ) : (
                <Button type="button" onClick={joinEvent} disabled={joining} className="h-11 text-sm">
                  {joining ? "..." : "Я иду"}
                </Button>
              )}

              {event.source_kind === "community" ? (
                <button
                  type="button"
                  disabled={companionLoading}
                  onClick={toggleCompanion}
                  className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60 active:scale-[0.98] ${
                    data.looking_company
                      ? "border-[rgb(var(--teal-rgb)/0.42)] bg-[rgb(var(--teal-rgb)/0.14)] text-text"
                      : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text hover:bg-[rgb(var(--surface-2-rgb))]"
                  }`}
                >
                  <MessageCircleHeart className="h-4 w-4" />
                  {companionLoading ? "..." : data.looking_company ? "Ищу компанию" : "Ищу с кем пойти"}
                </button>
              ) : event.external_url ? (
                <a
                  href={event.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-[rgb(var(--gold-rgb)/0.42)] bg-[rgb(var(--gold-rgb)/0.22)] px-4 text-sm font-semibold text-[rgb(98,75,20)] transition hover:brightness-[1.02] active:scale-[0.98]"
                >
                  Купить билет
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              <Button type="button" variant="secondary" onClick={() => refetch()} className="h-11 text-sm">
                {isFetching ? "Обновляем..." : "Обновить"}
              </Button>

              {data.is_owner && (event.status === "draft" || event.status === "pending_review") ? (
                <Button variant="secondary" onClick={() => window.location.assign(`/events/new?draftId=${event.id}`)}>
                  Редактировать
                </Button>
              ) : null}

              {data.is_owner && event.status === "draft" ? (
                <Button
                  onClick={async () => {
                    try {
                      await api(`/api/events/${event.id}/submit`, { method: "POST" });
                      await refetch();
                    } catch (e) {
                      setErrorBanner(e instanceof ApiClientError ? e.message : "Не удалось отправить на модерацию");
                    }
                  }}
                >
                  Отправить на модерацию
                </Button>
              ) : null}
            </div>

            <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.66)] p-4">
              <p className="text-xs uppercase tracking-wide text-text3">Контакты</p>
              {event.source_kind === "community" ? (
                <>
                  <p className="mt-2 text-sm text-text2">Организатор: {event.organizer_name || "Организатор"}</p>
                  <p className="mt-1 text-sm text-text2">
                    {event.organizer_telegram ? `Telegram: ${event.organizer_telegram}` : "Контакт организатора уточняется"}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-text2">Источник: {event.external_source || "Партнёрская афиша"}</p>
                  {event.external_url ? (
                    <a
                      href={event.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-[rgb(var(--sky-rgb))] hover:opacity-85"
                    >
                      Открыть оригинал
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </>
              )}
            </section>

            <section className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.66)] p-3">
              <p className="mb-2 text-sm font-semibold text-text">Кто уже идёт</p>
              <Input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Поиск участника"
                className="mb-2 h-10"
              />

              <div className="space-y-2">
                {filteredParticipants.length ? (
                  filteredParticipants.map((person) => (
                    <Link
                      key={person.id}
                      href={`/profile/${person.id}`}
                      className="tap-press flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] p-2"
                    >
                      <span className="flex items-center gap-2 text-sm text-text">
                        <Image
                          src={person.avatar_url || "https://placehold.co/80/f0f3ff/6b74b6?text=U"}
                          alt={person.name || "Участник"}
                          width={40}
                          height={40}
                          className="h-8 w-8 rounded-full border border-[rgb(var(--teal-rgb)/0.24)] object-cover"
                          unoptimized
                        />
                        {person.name || "Участник"}
                      </span>
                      <span className="text-xs text-text2">Профиль</span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-lg border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-xs text-text2">
                    Участники пока не найдены по текущему фильтру.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
