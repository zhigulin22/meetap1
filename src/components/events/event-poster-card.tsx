import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import type { EventListItem } from "@/components/events/types";

function formatDate(dateISO: string) {
  const date = new Date(dateISO);
  if (!Number.isFinite(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPriceText(event: EventListItem) {
  if (!event.is_paid || event.price <= 0) return "Бесплатно";
  return event.price_note?.trim() || `${event.price} ₽`;
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
    <article className="dual-edge overflow-hidden rounded-[24px] bg-[rgb(var(--surface-2-rgb)/0.94)]">
      <div className="relative">
        <Image
          src={event.cover_url || "https://placehold.co/1200x800/edf2ff/5f6fb7?text=EVENT"}
          alt={event.title}
          width={1200}
          height={800}
          className="h-52 w-full object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.08),rgba(17,24,39,0.5))]" />

        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--text-rgb))]">
          {event.category || "Событие"}
        </div>

        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--sky-rgb)/0.3)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--text-rgb))]">
          <CalendarDays className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
          {formatDate(event.starts_at)}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white">{event.title}</h3>
          <span className="shrink-0 rounded-full border border-[rgb(var(--gold-rgb)/0.45)] bg-[rgb(var(--gold-rgb)/0.24)] px-2.5 py-1 text-xs font-semibold text-[#654400]">
            {getPriceText(event)}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="signature-line" />

        <p className="line-clamp-2 text-sm text-text2">{event.short_description || event.full_description || "Описание скоро появится."}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text2">
          {event.city ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2 py-1">
              <MapPin className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
              {event.city}
            </span>
          ) : null}
          {event.external_source ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2 py-1">
              <Ticket className="h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" />
              {event.external_source}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--surface-1-rgb))] text-sm font-medium text-text transition hover:bg-[rgb(var(--teal-rgb)/0.08)] active:scale-[0.98]"
          >
            Посмотреть
          </Link>
          {event.joined ? (
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgb(var(--teal-rgb)/0.34)] bg-[rgb(var(--teal-rgb)/0.16)] text-sm font-semibold text-text">
              Вы идёте
            </span>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => onJoin(event.id)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[rgb(var(--peach-rgb))] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgb(var(--peach-rgb)/0.24)] transition hover:bg-[rgb(var(--peach-pressed-rgb))] disabled:opacity-60 active:scale-[0.98]"
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
            className="inline-flex items-center gap-1 text-xs text-[rgb(var(--teal-rgb))] transition hover:text-[rgb(var(--teal-hover-rgb))]"
          >
            Купить билет на источнике
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
