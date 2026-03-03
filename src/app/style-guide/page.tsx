import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";

export default function StyleGuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1>Style Guide: Electric Mint + Midnight</h1>
        <p className="text-sm text-text2">Brand signature: аккуратный mint glow + чистая типографика + stage-vibe hero без шумного фона.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Палитра и зоны</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Base (80%):</strong> feed, people, profile, settings, admin.</p>
            <p><strong className="text-text">Event Gold (15%):</strong> только ивенты, CTA “Пойти”, метки “Сегодня”.</p>
            <p><strong className="text-text">Badge Violet/Citrus (5%):</strong> только достижения и моменты “получено”.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Pill tone="teal">primary</Pill>
              <Pill tone="gold">event</Pill>
              <span className="inline-flex items-center rounded-full border border-[color:var(--border-soft)] bg-[image:var(--grad-badge)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--bg-rgb))]">badge</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Контраст и текст</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Правильно:</strong> основной текст только `#F6F8FF`, вторичный `#B7C2DA`.</p>
            <p><strong className="text-text">Неправильно:</strong> mint/violet в body-тексте, серый на сером, белые жирные рамки.</p>
            <p>Разделители и границы: `#1B2743` или `border-soft`, не ярче.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Компоненты</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Buttons: primary mint, secondary surface, destructive danger.</p>
            <p>Segmented tabs: iOS-style, выбранный tab на pearl tint.</p>
            <p>Cards: мягкие поверхности + тонкая граница, без тяжелой обводки.</p>
            <p>Empty states: причина + что сделать дальше.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Brand Signature</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Узнаваемый эффект: тонкая mint-световая линия на активных CTA и элементах выделения.</p>
            <p>Event mode правило: gold только для event карточек и “Пойти”.</p>
            <p>Badge mode правило: violet/citrus не выходят за пределы достижений.</p>
            <div className="space-y-1 pt-1 text-sm">
              <Link href="/theme-showcase" className="block text-cyan underline underline-offset-2">Theme Showcase</Link>
              <Link href="/profile/me" className="block text-cyan underline underline-offset-2">Профиль / настройки</Link>
              <Link href="/profile/me" className="block text-cyan underline underline-offset-2">Публичный профиль</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
