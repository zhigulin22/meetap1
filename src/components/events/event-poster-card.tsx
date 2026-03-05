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
  const price = getPriceText(event);

  return (
    <article className="group relative overflow-hidden rounded-[24px] bg-[linear-gradient(140deg,rgba(18,26,56,0.95),rgba(9,12,28,0.98))] p-[1px] shadow-[0_22px_50px_rgba(3,7,18,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(71,111,255,0.42),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(128,64,255,0.34),transparent_34%)] opacity-70" />
      <div className="relative overflow-hidden rounded-[23px] border border-[rgba(88,109,170,0.28)] bg-[#090f24]">
        <div className="relative">
          <Image
            src={event.cover_url || "https://placehold.co/1200x800/070a12/e8eeff?text=EVENT"}
            alt={event.title}
            width={1200}
            height={800}
            className="h-52 w-full object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,24,0.08),rgba(6,11,24,0.8))]" />

          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgba(142,178,255,0.35)] bg-[rgba(16,24,52,0.82)] px-2.5 py-1 text-[11px] font-medium text-[#dbe6ff]">
            {event.category || "Событие"}
          </div>

          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[rgba(157,166,255,0.4)] bg-[rgba(15,20,47,0.86)] px-2.5 py-1 text-[11px] font-medium text-[#e7ebff]">
            <CalendarDays className="h-3.5 w-3.5 text-[#88a8ff]" />
            {formatDate(event.starts_at)}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-[#f5f8ff]">{event.title}</h3>
            <span className="shrink-0 rounded-full border border-[rgba(242,196,109,0.36)] bg-[rgba(242,196,109,0.15)] px-2.5 py-1 text-xs font-semibold text-[#ffdca0]">
              {price}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="line-clamp-2 text-sm text-[#b9c5e2]">{event.short_description || event.full_description || "Описание скоро появится."}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9dafd8]">
            {event.city ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.28)] bg-[rgba(13,20,44,0.7)] px-2 py-1">
                <MapPin className="h-3.5 w-3.5 text-[#7ea7ff]" />
                {event.city}
              </span>
            ) : null}
            {event.external_source ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.28)] bg-[rgba(13,20,44,0.7)] px-2 py-1">
                <Ticket className="h-3.5 w-3.5 text-[#a18cff]" />
                {event.external_source}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/events/${event.id}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] text-sm font-medium text-[#d9e4ff] transition hover:border-[rgba(136,177,255,0.55)] hover:text-white active:scale-[0.98]"
            >
              Посмотреть
            </Link>
            {event.joined ? (
              <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(122,147,255,0.45)] bg-[rgba(96,119,255,0.18)] text-sm font-semibold text-[#dce4ff]">
                Вы идёте
              </span>
            ) : (
              <button
                type="button"
                disabled={joining}
                onClick={() => onJoin(event.id)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-4 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(76,112,255,0.42)] transition hover:brightness-110 disabled:opacity-60 active:scale-[0.98]"
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
              className="inline-flex items-center gap-1 text-xs text-[#8fb3ff] transition hover:text-[#c9dbff]"
            >
              Купить билет на источнике
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
