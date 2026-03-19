import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";

export default function StyleGuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-text">Style Guide: Black + Blue + Violet (Light-first)</h1>
        <p className="text-sm text-text2">Signature: мягкий blue→violet акцент, dual-edge карточки, светлые поверхности и нейтральный читаемый текст.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Палитра и зоны</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Base:</strong> светлая база, blue/violet как identity-акценты.</p>
            <p><strong className="text-text">Event Gold:</strong> только события и CTA “Пойти”.</p>
            <p><strong className="text-text">Badge Violet/Citrus:</strong> только достижения и момент получения.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Pill tone="teal">violet accent</Pill>
              <Pill tone="gold">event</Pill>
              <span className="inline-flex items-center rounded-full border border-[color:var(--border-soft)] bg-[image:var(--grad-badge)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">badge</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Контраст и текст</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">Правильно:</strong> основной текст только нейтральный (`--text` / `--text-2`).</p>
            <p><strong className="text-text">Неправильно:</strong> blue/violet в body-тексте, толстые белые рамки, низкий контраст.</p>
            <p>Разделители и границы: `--border-soft` и `--border`, без резких линий.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Компоненты</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Buttons: primary blue, secondary violet outline, ghost violet, destructive red.</p>
            <p>Tabs: pill with active blue→violet gradient + subtle glow.</p>
            <p>Cards: light surfaces + dual edge, не плоский “telegram list”.</p>
            <p>Empty states: причина + что сделать + куда нажать.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Brand Signature</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Узнаваемый эффект: signature-line + мягкий blue/violet glow в active элементах.</p>
            <p>Event mode: gold только в ивентах и специальных метках.</p>
            <p>Badge mode: violet/citrus только в достижениях.</p>
            <div className="space-y-1 pt-1 text-sm">
              <Link href="/theme-showcase" className="block text-[rgb(var(--sky-rgb))] underline underline-offset-2">Theme Showcase</Link>
              <Link href="/events" className="block text-[rgb(var(--sky-rgb))] underline underline-offset-2">События</Link>
              <Link href="/profile/me" className="block text-[rgb(var(--sky-rgb))] underline underline-offset-2">Мой профиль</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
