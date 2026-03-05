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
      queryClient.invalidateQueries({ queryKey: ["events-v2"] });
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
      queryClient.invalidateQueries({ queryKey: ["events-v2"] });
    } catch (e) {
      setErrorBanner(e instanceof ApiClientError ? e.message : "Не удалось обновить поиск компании");
    } finally {
      setCompanionLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <PageShell>
        <div className="overflow-hidden rounded-[24px] border border-[rgba(88,110,168,0.24)] bg-[linear-gradient(140deg,rgba(8,13,33,0.98),rgba(16,11,40,0.98))] p-4">
          <div className="mb-3 h-56 animate-pulse rounded-2xl bg-[rgba(89,108,171,0.22)]" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-[rgba(89,108,171,0.2)]" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-[rgba(89,108,171,0.18)]" />
          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[rgba(89,108,171,0.18)]" />
        </div>
      </PageShell>
    );
  }

  const event = data.event;

  return (
    <PageShell>
      <article className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(145deg,rgba(10,16,36,0.98),rgba(16,10,40,0.98))] p-[1px] shadow-[0_22px_48px_rgba(3,8,21,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(70,112,255,0.32),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(127,79,255,0.3),transparent_40%)]" />

        <div className="relative overflow-hidden rounded-[25px] border border-[rgba(92,112,170,0.3)] bg-[#080f24]">
          <div className="relative">
            <Image
              src={event.cover_url || "https://placehold.co/1280x800/070a12/e8eeff?text=EVENT"}
              alt={event.title}
              width={1280}
              height={800}
              className="h-60 w-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,23,0.12),rgba(5,10,23,0.84))]" />

            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgba(122,146,230,0.42)] bg-[rgba(14,22,48,0.8)] px-2.5 py-1 text-[11px] font-medium text-[#dce8ff]">
              {event.source_kind === "community" ? "Комьюнити" : "Афиша"}
            </div>

            <div className="absolute bottom-4 left-3 right-3">
              <h1 className="text-2xl font-semibold leading-tight text-[#f3f7ff]">{event.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#c1ceea]">
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.32)] bg-[rgba(13,20,44,0.72)] px-2 py-1">
                  <CalendarClock className="h-3.5 w-3.5 text-[#84a8ff]" />
                  {formatDate(event.starts_at)}
                </span>
                {event.city ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.32)] bg-[rgba(13,20,44,0.72)] px-2 py-1">
                    <MapPin className="h-3.5 w-3.5 text-[#9b8bff]" />
                    {event.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.32)] bg-[rgba(13,20,44,0.72)] px-2 py-1">
                  {event.category || "Событие"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {errorBanner ? (
              <div className="rounded-xl border border-[rgba(255,79,143,0.45)] bg-[rgba(255,79,143,0.12)] px-3 py-2 text-xs text-[#ffc0db]">
                {errorBanner}
              </div>
            ) : null}

            <p className="text-sm leading-relaxed text-[#bac5df]">{event.full_description || event.short_description || "Описание скоро появится."}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[rgba(102,124,194,0.35)] bg-[rgba(13,21,48,0.78)] p-3">
                <p className="text-xs text-[#93a8d1]">Идут</p>
                <p className="text-lg font-semibold text-[#f4f7ff]">{data.going_count}</p>
              </div>
              <div className="rounded-xl border border-[rgba(102,124,194,0.35)] bg-[rgba(13,21,48,0.78)] p-3">
                <p className="text-xs text-[#93a8d1]">Ищут компанию</p>
                <p className="text-lg font-semibold text-[#f4f7ff]">{data.companion_count}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {data.joined ? (
                <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(122,147,255,0.45)] bg-[rgba(96,119,255,0.18)] text-sm font-semibold text-[#dce4ff]">
                  Вы идёте
                </span>
              ) : (
                <button
                  type="button"
                  onClick={joinEvent}
                  disabled={joining}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(76,112,255,0.42)] transition hover:brightness-110 disabled:opacity-60 active:scale-[0.98]"
                >
                  {joining ? "..." : "Я иду"}
                </button>
              )}

              {event.source_kind === "community" ? (
                <button
                  type="button"
                  disabled={companionLoading}
                  onClick={toggleCompanion}
                  className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60 active:scale-[0.98] ${
                    data.looking_company
                      ? "border-[rgba(137,117,255,0.56)] bg-[rgba(137,117,255,0.2)] text-[#ece7ff]"
                      : "border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] text-[#d9e4ff] hover:border-[rgba(156,178,235,0.45)]"
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
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-[rgba(242,196,109,0.48)] bg-[rgba(242,196,109,0.18)] px-4 text-sm font-semibold text-[#ffe6ae] transition hover:brightness-105 active:scale-[0.98]"
                >
                  Купить билет
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] px-4 text-sm font-medium text-[#d9e4ff] transition hover:border-[rgba(156,178,235,0.45)] hover:text-white active:scale-[0.98]"
              >
                {isFetching ? "Обновляем..." : "Обновить"}
              </button>
            </div>

            {event.source_kind === "community" ? (
              <div className="rounded-xl border border-[rgba(110,133,204,0.34)] bg-[rgba(14,21,46,0.75)] p-3 text-xs text-[#a8bbdf]">
                <p>Формат: {socialModeLabel(event.social_mode)}</p>
                {event.organizer_telegram ? <p className="mt-1">Контакт организатора: {event.organizer_telegram}</p> : null}
                {event.is_paid ? (
                  <p className="mt-1">
                    Условия оплаты: {event.price_note || (event.price > 0 ? `${event.price} ₽` : "уточнить у организатора")}
                  </p>
                ) : (
                  <p className="mt-1">Событие бесплатное</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[rgba(110,133,204,0.34)] bg-[rgba(14,21,46,0.75)] p-3 text-xs text-[#a8bbdf]">
                <p>Источник: {event.external_source || "Партнёрская афиша"}</p>
                {event.external_url ? (
                  <a href={event.external_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#93b5ff] hover:text-[#d3e2ff]">
                    Открыть оригинал
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            )}

            <section className="rounded-xl border border-[rgba(110,133,204,0.34)] bg-[rgba(14,21,46,0.75)] p-3">
              <p className="mb-2 text-sm font-semibold text-[#eef3ff]">Кто уже идёт</p>
              <input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Поиск участника"
                className="mb-2 h-10 w-full rounded-xl border border-[rgba(84,106,168,0.34)] bg-[rgba(9,15,35,0.86)] px-3 text-sm text-[#edf2ff] placeholder:text-[#7f95c5] focus:border-[rgba(111,145,255,0.65)] focus:outline-none"
              />

              <div className="space-y-2">
                {filteredParticipants.length ? (
                  filteredParticipants.map((person) => (
                    <Link
                      key={person.id}
                      href={`/profile/${person.id}`}
                      className="tap-press flex items-center justify-between rounded-xl border border-[rgba(100,123,192,0.34)] bg-[rgba(15,23,50,0.78)] p-2"
                    >
                      <span className="flex items-center gap-2 text-sm text-[#d9e4ff]">
                        <Image
                          src={person.avatar_url || "https://placehold.co/80/0a1530/eaf0ff?text=U"}
                          alt={person.name || "Участник"}
                          width={40}
                          height={40}
                          className="h-8 w-8 rounded-full border border-[rgba(97,120,194,0.45)] object-cover"
                          unoptimized
                        />
                        {person.name || "Участник"}
                      </span>
                      <span className="text-xs text-[#9fb1d9]">Профиль</span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-lg border border-[rgba(102,124,194,0.35)] bg-[rgba(13,21,48,0.72)] px-3 py-2 text-xs text-[#9eb2dc]">
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
