import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ExternalLink, MapPin, Ticket, Users, Sparkles } from "lucide-react";
import type { EventListItem } from "@/components/events/types";
import { Button } from "@/components/ui/button";

function formatDateTimeRange(startsAt: string, endsAt?: string | null) {
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) return "Дата не указана";
  const startText = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);

  if (!endsAt) return startText;
  const end = new Date(endsAt);
  if (!Number.isFinite(end.getTime())) return startText;
  const endText = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(end);
  return `${startText} – ${endText}`;
}

function getPriceText(event: EventListItem) {
  if (!event.is_paid || event.price <= 0) return "Бесплатно";
  return event.price_note?.trim() || `${event.price} ₽`;
}

function venueText(event: EventListItem) {
  if (event.venue_name && event.venue_address) return `${event.venue_name}, ${event.venue_address}`;
  if (event.venue_name) return event.venue_name;
  if (event.venue_address) return event.venue_address;
  return "Место уточняется";
}

export function EventPosterCard({
  event,
  joining,
  onJoin,
}: {
  event: EventListItem;
  joining: boolean;
  onJoin: (eventId: string) => Promise<void> | void;
}) {
  return (
    <article className="dual-edge overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,rgba(18,24,52,0.96),rgba(12,18,40,0.96))]">
      <div className="relative">
        <Image
          src={event.cover_url || "https://placehold.co/1200x800/0c1326/8b9bd6?text=EVENT"}
          alt={event.title}
          width={1200}
          height={800}
          className="h-60 w-full object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(8,12,24,0.78))]" />

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--text-rgb))]">
          {event.category || "Событие"}
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.18)] px-2 py-0.5 text-[10px] font-semibold text-white">
            Trend
          </span>
        </div>

        <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--sky-rgb)/0.4)] bg-[rgb(var(--surface-1-rgb)/0.85)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--text-rgb))]">
          <CalendarDays className="h-4 w-4 text-[rgb(var(--sky-rgb))]" />
          {formatDateTimeRange(event.starts_at, event.ends_at)}
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white">{event.title}</h3>
          <span className="shrink-0 rounded-full border border-[rgb(var(--gold-rgb)/0.5)] bg-[rgb(var(--gold-rgb)/0.28)] px-3 py-1.5 text-xs font-semibold text-white">
            {getPriceText(event)}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="signature-line" />

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {event.is_today ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.18)] px-2.5 py-1 text-white">
              <Sparkles className="h-3.5 w-3.5" /> Сегодня
            </span>
          ) : null}
          {!event.is_paid || event.price <= 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.18)] px-2.5 py-1 text-white">
              <Ticket className="h-3.5 w-3.5" /> Бесплатно
            </span>
          ) : null}
          {event.going_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--teal-rgb)/0.4)] bg-[rgb(var(--teal-rgb)/0.16)] px-2.5 py-1 text-text">
              <Users className="h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" /> {event.going_count} идут
            </span>
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm text-text2">{event.short_description || event.full_description || "Описание скоро появится."}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text2">
          {event.city ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
              {event.city}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
            {venueText(event)}
          </span>
          {event.external_source ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
              <Ticket className="h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" />
              {event.external_source}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href={`/events/${event.id}`} className="w-full">
            <Button variant="secondary" className="w-full h-12">
              Посмотреть
            </Button>
          </Link>
          {event.joined ? (
            <span className="inline-flex h-12 items-center justify-center rounded-full border border-[rgb(var(--teal-rgb)/0.34)] bg-[rgb(var(--teal-rgb)/0.16)] text-sm font-semibold text-text">
              Вы идёте
            </span>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => onJoin(event.id)}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[image:var(--grad-primary)] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgb(var(--violet-rgb)/0.3)] transition hover:brightness-[1.03] disabled:opacity-60 active:scale-[0.98]"
            >
              {joining ? "..." : "Я иду"}
            </button>
          )}
        </div>

        {event.external_url ? (
          <a
            href={event.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[rgb(var(--sky-rgb))] transition hover:text-[rgb(var(--teal-rgb))]"
          >
            Купить билет на источнике
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
