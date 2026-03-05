import Image from "next/image";
import Link from "next/link";
import { CalendarClock, MapPin, MessageCircleHeart, Users } from "lucide-react";
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
    <article className="dual-edge relative overflow-hidden rounded-[24px] bg-[rgb(var(--surface-2-rgb)/0.94)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgb(var(--sky-rgb)/0.12),transparent_42%),radial-gradient(circle_at_92%_8%,rgb(var(--violet-rgb)/0.12),transparent_40%)]" />
      <div className="relative p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--teal-rgb)/0.14)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--text-rgb))]">
              {socialLabel(event.social_mode)}
            </div>
            <h3 className="text-lg font-semibold leading-tight text-text">{event.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.88)] px-2.5 py-1 text-xs text-text2">
            {event.category || "Комьюнити"}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-text2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.86)] px-2 py-1">
            <CalendarClock className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
            {formatDate(event.starts_at)}
          </span>
          {event.city ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.86)] px-2 py-1">
              <MapPin className="h-3.5 w-3.5 text-[rgb(var(--teal-rgb))]" />
              {event.city}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.86)] px-2 py-1">
            {socialModeMeta(event.social_mode)}
          </span>
        </div>

        <p className="line-clamp-3 text-sm text-text2">{event.short_description || event.full_description || "Описание скоро появится."}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-[rgb(var(--teal-rgb)/0.24)] bg-[rgb(var(--teal-rgb)/0.08)] p-2">
            <p className="mb-1 text-text3">Идут</p>
            <p className="text-base font-semibold text-text">{event.going_count}</p>
          </div>
          <div className="rounded-xl border border-[rgb(var(--sky-rgb)/0.24)] bg-[rgb(var(--sky-rgb)/0.08)] p-2">
            <p className="mb-1 text-text3">Ищут компанию</p>
            <p className="text-base font-semibold text-text">{event.companion_count}</p>
          </div>
        </div>

        <div className="mt-3 flex -space-x-2">
          {event.participants.slice(0, 6).map((person) => (
            <Image
              key={person.id}
              src={person.avatar_url || "https://placehold.co/100/edf2ff/5f6fb7?text=U"}
              alt={person.name || "Участник"}
              width={64}
              height={64}
              className="h-8 w-8 rounded-full border border-[rgb(var(--teal-rgb)/0.35)] object-cover"
              unoptimized
            />
          ))}
          {event.going_count > 6 ? <span className="ml-3 inline-flex items-center text-xs text-text3">+{event.going_count - 6}</span> : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--surface-1-rgb))] text-sm font-medium text-text transition hover:bg-[rgb(var(--teal-rgb)/0.08)] active:scale-[0.98]"
          >
            Посмотреть
          </Link>

          {event.joined ? (
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgb(var(--teal-rgb)/0.34)] bg-[rgb(var(--teal-rgb)/0.16)] px-2 text-center text-xs font-semibold text-text">
              Вы в списке
            </span>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => onJoin(event.id)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[rgb(var(--peach-rgb))] px-2 text-center text-xs font-semibold text-white shadow-[0_10px_22px_rgb(var(--peach-rgb)/0.24)] transition hover:bg-[rgb(var(--peach-pressed-rgb))] disabled:opacity-60 active:scale-[0.98]"
            >
              {joining ? "..." : "Я иду"}
            </button>
          )}

          <button
            type="button"
            disabled={companionLoading}
            onClick={() => onToggleCompanion(event.id)}
            className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl border px-2 text-center text-xs font-semibold transition disabled:opacity-60 active:scale-[0.98] ${
              event.looking_company
                ? "border-[rgb(var(--teal-rgb)/0.42)] bg-[rgb(var(--teal-rgb)/0.16)] text-text"
                : "border-[rgb(var(--teal-rgb)/0.3)] bg-[rgb(var(--surface-1-rgb))] text-text hover:bg-[rgb(var(--teal-rgb)/0.08)]"
            }`}
          >
            <MessageCircleHeart className="h-3.5 w-3.5" />
            {companionLoading ? "..." : event.looking_company ? "Ищу" : "Компания"}
          </button>
        </div>

        {event.organizer_telegram ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.86)] px-2.5 py-1 text-[11px] text-text2">
            <Users className="h-3.5 w-3.5 text-[rgb(var(--sky-rgb))]" />
            Организатор: {event.organizer_telegram}
          </div>
        ) : null}
      </div>
    </article>
  );
}
