"use client";

import { useState } from "react";
import { BadgeIcon } from "@/components/badge-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ThemeShowcasePage() {
  const [tab, setTab] = useState("base");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-2">Theme Showcase</h1>
      <p className="mb-4 text-sm text-text2">Демонстрация базового режима, event mode и badges mode.</p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="base">Base</TabsTrigger>
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="badge">Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="base">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Base controls</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Поиск, сообщение или фильтр" />
                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                </div>
                <div className="empty-state">Empty state: нет данных. Проверь источник данных или обнови фильтр.</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="event">
          <div className="grid gap-4 md:grid-cols-2 event-mode">
            <Card className="event-surface border-gold/20">
              <CardHeader><CardTitle>Event mode</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-text2">Используй gold только для ивентов и CTA “Пойти”.</p>
                <Button variant="event">Пойти</Button>
                <div className="inline-flex rounded-full border border-gold/35 bg-gold/15 px-3 py-1 text-xs text-[rgb(var(--ivory-rgb))]">СЕГОДНЯ</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="badge">
          <div className="grid gap-4 md:grid-cols-2 badge-mode">
            <Card>
              <CardHeader><CardTitle>Badges mode</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-text2">Violet + Citrus только для достижений.</p>
                <div className="flex items-center gap-2">
                  <BadgeIcon name="Trophy" rarity="legendary" earned={true} />
                  <BadgeIcon name="CalendarCheck" rarity="epic" earned={false} />
                  <BadgeIcon name="Sparkles" rarity="rare" earned={true} />
                </div>
                <Button className="bg-[image:var(--grad-badge)] text-[rgb(var(--bg-rgb))]">Получен новый бейдж</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
