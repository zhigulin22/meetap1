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
    <article className="group relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,rgba(10,17,38,0.98),rgba(17,12,45,0.98))] p-[1px] shadow-[0_20px_45px_rgba(4,8,22,0.56)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(76,118,255,0.32),transparent_38%),radial-gradient(circle_at_92%_8%,rgba(116,83,255,0.3),transparent_36%)]" />
      <div className="relative overflow-hidden rounded-[23px] border border-[rgba(88,110,168,0.3)] bg-[#080f24] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[rgba(119,142,230,0.42)] bg-[rgba(15,24,58,0.8)] px-2.5 py-1 text-[11px] font-medium text-[#dbe6ff]">
              {socialLabel(event.social_mode)}
            </div>
            <h3 className="text-lg font-semibold leading-tight text-[#f4f7ff]">{event.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-[rgba(128,154,232,0.4)] bg-[rgba(16,22,48,0.8)] px-2.5 py-1 text-xs text-[#dde7ff]">
            {event.category || "Комьюнити"}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#a9bcdf]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.3)] bg-[rgba(13,20,44,0.7)] px-2 py-1">
            <CalendarClock className="h-3.5 w-3.5 text-[#81a6ff]" />
            {formatDate(event.starts_at)}
          </span>
          {event.city ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.3)] bg-[rgba(13,20,44,0.7)] px-2 py-1">
              <MapPin className="h-3.5 w-3.5 text-[#8f8bff]" />
              {event.city}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,149,214,0.3)] bg-[rgba(13,20,44,0.7)] px-2 py-1">
            {socialModeMeta(event.social_mode)}
          </span>
        </div>

        <p className="line-clamp-3 text-sm text-[#b9c4df]">{event.short_description || event.full_description || "Описание скоро появится."}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-[rgba(102,124,194,0.35)] bg-[rgba(13,21,48,0.78)] p-2">
            <p className="mb-1 text-[#90a6d2]">Идут</p>
            <p className="text-base font-semibold text-[#f4f7ff]">{event.going_count}</p>
          </div>
          <div className="rounded-xl border border-[rgba(102,124,194,0.35)] bg-[rgba(13,21,48,0.78)] p-2">
            <p className="mb-1 text-[#90a6d2]">Ищут компанию</p>
            <p className="text-base font-semibold text-[#f4f7ff]">{event.companion_count}</p>
          </div>
        </div>

        <div className="mt-3 flex -space-x-2">
          {event.participants.slice(0, 6).map((person) => (
            <Image
              key={person.id}
              src={person.avatar_url || "https://placehold.co/100/0a1530/eaf0ff?text=U"}
              alt={person.name || "Участник"}
              width={64}
              height={64}
              className="h-8 w-8 rounded-full border border-[rgba(97,120,194,0.45)] object-cover"
              unoptimized
            />
          ))}
          {event.going_count > 6 ? <span className="ml-3 inline-flex items-center text-xs text-[#99abd1]">+{event.going_count - 6}</span> : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] text-sm font-medium text-[#d9e4ff] transition hover:border-[rgba(136,177,255,0.55)] hover:text-white active:scale-[0.98]"
          >
            Посмотреть
          </Link>

          {event.joined ? (
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[rgba(122,147,255,0.45)] bg-[rgba(96,119,255,0.18)] px-2 text-center text-xs font-semibold text-[#dce4ff]">
              Вы в списке
            </span>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => onJoin(event.id)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4c70ff,#6b4dff)] px-2 text-center text-xs font-semibold text-white shadow-[0_10px_24px_rgba(76,112,255,0.42)] transition hover:brightness-110 disabled:opacity-60 active:scale-[0.98]"
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
                ? "border-[rgba(137,117,255,0.56)] bg-[rgba(137,117,255,0.2)] text-[#ece7ff]"
                : "border-[rgba(126,153,214,0.35)] bg-[rgba(18,27,58,0.9)] text-[#d9e4ff] hover:border-[rgba(156,178,235,0.45)]"
            }`}
          >
            <MessageCircleHeart className="h-3.5 w-3.5" />
            {companionLoading ? "..." : event.looking_company ? "Ищу" : "Компания"}
          </button>
        </div>

        {event.organizer_telegram ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[rgba(116,140,215,0.32)] bg-[rgba(16,24,52,0.76)] px-2.5 py-1 text-[11px] text-[#a8bbdf]">
            <Users className="h-3.5 w-3.5 text-[#8aa8ff]" />
            Организатор: {event.organizer_telegram}
          </div>
        ) : null}
      </div>
    </article>
  );
}
