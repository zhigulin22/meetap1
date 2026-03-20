import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <Card className="overflow-hidden">
      <Image
        src={event.cover_url || "https://placehold.co/1200x700"}
        alt={event.title}
        width={1200}
        height={700}
        className="h-44 w-full object-cover"
        unoptimized
      />

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight">{event.title}</h3>
          <span className="rounded-full border border-border bg-black/20 px-2 py-1 text-xs text-muted">
            {event.price === 0 ? "Бесплатно" : `${event.price} ₽`}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-muted">{event.description}</p>
        <p className="text-xs text-muted">{new Date(event.event_date).toLocaleString("ru-RU")}</p>

        <div className="flex -space-x-2">
          {event.participants.slice(0, 5).map((p, idx) => (
            <Image
              key={`${p.id}-${idx}`}
              src={p.avatar_url || "https://placehold.co/100"}
              alt="avatar"
              width={100}
              height={100}
              className="h-8 w-8 rounded-full border border-border object-cover"
              unoptimized
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/events/${event.id}`}>
            <Button variant="secondary" className="w-full">
              Открыть
            </Button>
          </Link>

          {event.joined ? (
            <div className="flex h-11 items-center justify-center rounded-2xl border border-[#52cc83]/50 bg-[#52cc83]/15 text-sm font-semibold text-[#52cc83]">
              Регистрация успешна
            </div>
          ) : (
            <Button className="w-full" onClick={() => onJoin(event.id)} disabled={joining}>
              {joining ? "..." : "Я иду"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
