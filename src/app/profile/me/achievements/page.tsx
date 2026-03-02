"use client";

import { useQuery } from "@tanstack/react-query";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

const colorByCategory: Record<string, string> = {
  "Активность": "border-[#6f9fff]/40 bg-[#6f9fff]/15 text-[#e7eeff]",
  "Ивенты": "border-[#5dd2a4]/40 bg-[#5dd2a4]/15 text-[#defcf2]",
  "Общение": "border-[#7ac2ff]/40 bg-[#7ac2ff]/15 text-[#e0f3ff]",
  "Сезонные": "border-[#9fb0ff]/40 bg-[#9fb0ff]/15 text-[#edf0ff]",
};

export default function ProfileAchievementsPage() {
  const badgesQuery = useQuery({
    queryKey: ["profile-badges-page"],
    queryFn: () => api<{ featured: any; earned: any[]; available: any[] }>("/api/profile/badges"),
  });

  async function featureBadge(badgeId: string) {
    await api("/api/profile/badges/feature", { method: "POST", body: JSON.stringify({ badgeId }) });
    await badgesQuery.refetch();
  }

  const earned = badgesQuery.data?.earned ?? [];
  const available = badgesQuery.data?.available ?? [];

  return (
    <ProfileSettingsLayout title="Достижения" subtitle="Полученные — яркие, не полученные — черно-белые">
      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Полученные бейджи</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {earned.length ? (
            earned.map((b: any) => {
              const badge = b.badge ?? {};
              const color = colorByCategory[badge.category] ?? "border-[#7aa2ff]/35 bg-[#7aa2ff]/12 text-[#e7eeff]";
              return (
                <div key={b.id} className={`rounded-xl border p-3 ${color}`}>
                  <p className="text-sm font-medium">{badge.title}</p>
                  <p className="text-xs opacity-90">{badge.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] opacity-80">{badge.category || "Бейдж"}</p>
                    <Button size="sm" variant={b.is_featured ? "default" : "secondary"} onClick={() => featureBadge(badge.id)}>
                      {b.is_featured ? "Главный" : "Сделать главным"}
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted">Пока нет полученных бейджей</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Все доступные бейджи</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {available.length ? (
            available.map((badge: any) => (
              <div key={badge.id} className="rounded-xl border border-white/15 bg-black/20 p-3 text-[#cfd7e5] grayscale">
                <p className="text-sm font-medium">{badge.title}</p>
                <p className="text-xs text-muted">{badge.description}</p>
                <p className="mt-1 text-[11px] text-muted">{badge.category || "Бейдж"}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted">Список пуст</p>
          )}
        </CardContent>
      </Card>
    </ProfileSettingsLayout>
  );
}
