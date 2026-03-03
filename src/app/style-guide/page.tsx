import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";

export default function StyleGuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1>Style Guide: Mint Peach</h1>
        <p className="text-sm text-text2">Signature: аккуратная peach→mint линия, мягкий grain, чистая типографика и много воздуха.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Палитра и зоны</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Base (80%):</strong> feed, people, profile, settings, admin.</p>
            <p><strong className="text-text">Event Gold (15%):</strong> только ивенты, CTA “Пойти”, метки “Сегодня”.</p>
            <p><strong className="text-text">Badge Violet/Citrus (5%):</strong> только достижения и моменты “получено”.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Pill tone="teal">mint accent</Pill>
              <Pill tone="gold">event</Pill>
              <span className="inline-flex items-center rounded-full border border-[color:var(--border-soft)] bg-[image:var(--grad-badge)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">badge</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Контраст и текст</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Правильно:</strong> основной текст только `#12201C`, вторичный `#3F5A53`.</p>
            <p><strong className="text-text">Неправильно:</strong> peach/mint в body-тексте, серый на сером, толстые белые рамки.</p>
            <p>Разделители и границы: `#DFF3EC` и `border-soft`, без резких линий.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Компоненты</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Buttons: primary peach, secondary surface, ghost mint, destructive danger.</p>
            <p>Segmented tabs: mint active pill + neutral text.</p>
            <p>Cards: light surfaces + мягкая тень, без heavy-обводок.</p>
            <p>Empty states: причина + что сделать + куда нажать.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Brand Signature</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Узнаваемый эффект: тонкая peach→mint линия на ключевых CTA и выделениях.</p>
            <p>Event mode: gold только в ивентах и special-моментах.</p>
            <p>Badge mode: violet/citrus только в достижениях.</p>
            <div className="space-y-1 pt-1 text-sm">
              <Link href="/theme-showcase" className="block text-cyan underline underline-offset-2">Theme Showcase</Link>
              <Link href="/profile/me" className="block text-cyan underline underline-offset-2">Мой профиль</Link>
              <Link href="/profile/me" className="block text-cyan underline underline-offset-2">Настройки</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
