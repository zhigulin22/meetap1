"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

export default function ProfilePage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["profile", params.id],
    queryFn: () => api<{ profile: any }>(`/api/profile/${params.id}`),
  });

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-56 w-full rounded-3xl" />
      </PageShell>
    );
  }

  if (!data?.profile) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-4 text-sm text-muted">Профиль не найден</CardContent>
        </Card>
      </PageShell>
    );
  }

  const p = data.profile;

  return (
    <PageShell>
      <Card className="overflow-hidden border-white/15 bg-surface/90 backdrop-blur-xl">
        <div className="h-20 bg-[linear-gradient(120deg,rgba(12,20,68,0.95),rgba(82,204,131,0.3),rgba(90,125,255,0.45))]" />
        <CardContent className="space-y-4 p-4">
          <div className="-mt-10 flex items-end gap-3">
            <Image
              src={p.avatar_url || "https://placehold.co/120"}
              alt={p.name}
              width={120}
              height={120}
              className="h-20 w-20 rounded-2xl border-2 border-white/70 object-cover"
              unoptimized
            />
            <div className="pb-1">
              <h1 className="text-xl font-semibold">{p.name}</h1>
              <p className="text-xs text-muted">Level {p.level} · XP {p.xp}</p>
            </div>
          </div>

          <p className="text-sm text-muted">{p.university || "ВУЗ не указан"} · {p.work || "Работа не указана"}</p>

          <div>
            <p className="text-sm font-medium">Интересы</p>
            <p className="text-sm text-muted">{(p.interests || []).join(", ") || "Не заполнено"}</p>
          </div>

          <div>
            <p className="text-sm font-medium">3 факта</p>
            <ul className="list-disc pl-5 text-sm text-muted">
              {(p.facts || []).map((fact: string) => <li key={fact}>{fact}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
