import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";

type Event = {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  event_date: string;
  price: number;
  participants: Array<{ id: string; avatar_url: string | null }>;
  joined?: boolean;
};

export function EventCard({
  event,
  onJoin,
  joining,
}: {
  event: Event;
  onJoin: (id: string) => void;
  joining?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.98)] shadow-soft">
      <div className="relative">
        <Image
          src={event.cover_url || "https://placehold.co/1200x700"}
          alt={event.title}
          width={1200}
          height={700}
          className="h-44 w-full object-cover"
          unoptimized
        />
        <div className="absolute left-3 top-3">
          <Pill tone="gold">сегодня</Pill>
        </div>
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="h-[2px] w-full rounded-full bg-[linear-gradient(90deg,rgb(var(--peach-rgb)/0.32),rgb(var(--gold-rgb)/0.42),rgb(var(--peach-rgb)/0.32))]" />

        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-text">{event.title}</h3>
          <span className="rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-2.5 py-1 text-xs text-text2">
            {event.price === 0 ? "Бесплатно" : `${event.price} ₽`}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-text2">{event.description}</p>
        <p className="inline-flex items-center gap-1.5 text-xs text-text2">
          <CalendarDays className="h-3.5 w-3.5 text-[rgb(var(--gold-rgb))]" /> {new Date(event.event_date).toLocaleString("ru-RU")}
        </p>

        <div className="flex -space-x-2">
          {event.participants.slice(0, 5).map((p, idx) => (
            <Image
              key={`${p.id}-${idx}`}
              src={p.avatar_url || "https://placehold.co/100"}
              alt="avatar"
              width={100}
              height={100}
              className="h-8 w-8 rounded-full border border-[color:var(--border-soft)] object-cover"
              unoptimized
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link href={`/events/${event.id}`} className="text-sm text-cyan hover:text-text">
            Открыть карточку
          </Link>

          {event.joined ? (
            <span className="inline-flex h-10 items-center rounded-full border border-[rgb(var(--teal-rgb)/0.35)] bg-[rgb(var(--teal-rgb)/0.14)] px-4 text-sm font-semibold text-[rgb(var(--teal-hover-rgb))]">
              Регистрация успешна
            </span>
          ) : (
            <Button variant="event" onClick={() => onJoin(event.id)} disabled={joining}>
              {joining ? "..." : "Пойти"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
