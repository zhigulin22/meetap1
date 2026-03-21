import Image from "next/image";
import Link from "next/link";
import { CalendarClock, MapPin, MessageCircleHeart, Users, Sparkles } from "lucide-react";
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

function socialLabel(mode: string) {
  if (mode === "looking_company") return "Ищу компанию";
  if (mode === "collect_group") return "Собираю группу";
  return "Комьюнити";
}

function socialModeMeta(mode: string) {
  if (mode === "looking_company") return "Ищу компанию";
  if (mode === "collect_group") return "Собираю группу";
  return "Организую";
}

function priceText(event: EventListItem) {
  if (!event.is_paid || event.price <= 0) return "Бесплатно";
  return event.price_note?.trim() || `${event.price} ₽`;
}

function venueText(event: EventListItem) {
  if (event.venue_name && event.venue_address) return `${event.venue_name}, ${event.venue_address}`;
  if (event.venue_name) return event.venue_name;
  if (event.venue_address) return event.venue_address;
  return "Место уточняется";
}

export function EventSocialCard({
  event,
  joining,
  companionLoading,
  onJoin,
  onToggleCompanion,
}: {
  event: EventListItem;
  joining: boolean;
  companionLoading: boolean;
  onJoin: (eventId: string) => Promise<void> | void;
  onToggleCompanion: (eventId: string) => Promise<void> | void;
}) {
  return (
    <article className="dual-edge relative overflow-hidden rounded-[32px] bg-[rgb(var(--surface-1-rgb)/0.92)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgb(var(--sky-rgb)/0.12),transparent_42%),radial-gradient(circle_at_92%_8%,rgb(var(--violet-rgb)/0.12),transparent_40%)]" />
      <div className="relative p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--teal-rgb)/0.14)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--text-rgb))]">
              {socialLabel(event.social_mode)}
            </div>
            <h3 className="text-lg font-semibold leading-tight text-text">{event.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-3 py-1.5 text-sm text-text2">
            {event.category || "Комьюнити"}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.18)] px-2.5 py-1 text-white">
            Комьюнити
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.18)] px-2.5 py-1 text-white">
            Verified
          </span>
          {event.is_today ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.18)] px-2.5 py-1 text-white">
              <Sparkles className="h-3.5 w-3.5" /> Сегодня
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm text-text2 sm:grid-cols-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
            <CalendarClock className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
            {formatDateTimeRange(event.starts_at, event.ends_at)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
            <MapPin className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
            {event.city || "Москва"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1">
            {venueText(event)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--gold-rgb)/0.45)] bg-[rgb(var(--gold-rgb)/0.2)] px-2.5 py-1 text-[#5b3f14]">
            {priceText(event)}
          </span>
        </div>

        <p className="mt-3 line-clamp-3 text-sm text-text2">{event.short_description || event.full_description || "Описание скоро появится."}</p>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-full border border-[rgb(var(--teal-rgb)/0.24)] bg-[rgb(var(--teal-rgb)/0.08)] p-3">
            <p className="mb-1 text-text3">Идут</p>
            <p className="text-base font-semibold text-text">{event.going_count}</p>
          </div>
          <div className="rounded-full border border-[rgb(var(--sky-rgb)/0.24)] bg-[rgb(var(--sky-rgb)/0.08)] p-3">
            <p className="mb-1 text-text3">Ищут компанию</p>
            <p className="text-base font-semibold text-text">{event.companion_count}</p>
          </div>
        </div>

        <div className="mt-3 flex -space-x-2">
          {event.participants.slice(0, 6).map((person) => (
            <Link key={person.id} href={`/profile/${person.id}`} className="block">
              <Image
                src={person.avatar_url || "https://placehold.co/100/0c1326/8b9bd6?text=U"}
                alt={person.name || "Участник"}
                width={64}
                height={64}
                className="h-9 w-9 rounded-full border border-[rgb(var(--teal-rgb)/0.35)] object-cover"
                unoptimized
              />
            </Link>
          ))}
          {event.going_count > 6 ? <span className="ml-3 inline-flex items-center text-sm text-text3">+{event.going_count - 6}</span> : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Link href={`/events/${event.id}`} className="w-full">
            <Button variant="secondary" className="w-full h-12">
              Посмотреть
            </Button>
          </Link>

          {event.joined ? (
            <span className="inline-flex h-12 items-center justify-center rounded-full border border-[rgb(var(--teal-rgb)/0.34)] bg-[rgb(var(--teal-rgb)/0.16)] px-4 text-center text-sm font-semibold text-text">
              Вы в списке
            </span>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => onJoin(event.id)}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[image:var(--grad-primary)] px-4 text-center text-sm font-semibold text-white shadow-[0_12px_24px_rgb(var(--violet-rgb)/0.3)] transition hover:brightness-[1.03] disabled:opacity-60 active:scale-[0.98]"
            >
              {joining ? "..." : "Я иду"}
            </button>
          )}

          <button
            type="button"
            disabled={companionLoading}
            onClick={() => onToggleCompanion(event.id)}
            className={`inline-flex h-12 items-center justify-center gap-1 rounded-full border px-4 text-center text-sm font-semibold transition disabled:opacity-60 active:scale-[0.98] ${
              event.looking_company
                ? "border-[rgb(var(--teal-rgb)/0.42)] bg-[rgb(var(--teal-rgb)/0.16)] text-text"
                : "border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--surface-2-rgb))] text-text hover:bg-[rgb(var(--teal-rgb)/0.08)]"
            }`}
          >
            <MessageCircleHeart className="h-3.5 w-3.5" />
            {companionLoading ? "..." : event.looking_company ? "Ищу" : "Компания"}
          </button>
        </div>

        {event.organizer_telegram || event.organizer_name ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.86)] px-3 py-1 text-[11px] text-text2">
            <Users className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
            Организатор: {event.organizer_name || event.organizer_telegram}
          </div>
        ) : null}

        <div className="mt-3 text-sm text-text3">Формат: {socialModeMeta(event.social_mode)}</div>
      </div>
    </article>
  );
}
