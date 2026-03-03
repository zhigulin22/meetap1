import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StyleGuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1>Style Guide: Teal Ocean + Pearl</h1>
        <p className="text-sm text-text2">Единый стандарт интерфейса: база 80%, event gold 15%, badges violet/citrus 5%.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Где использовать цвета</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p><strong className="text-text">База (Teal/Pearl):</strong> feed, people, profile, settings, admin.</p>
            <p><strong className="text-text">Midnight Gold:</strong> только ивенты, кнопки “Пойти”, event badges.</p>
            <p><strong className="text-text">Violet + Citrus:</strong> только достижения и моменты “бейдж получен”.</p>
            <p className="text-text3">Запрещено: розовый, кислотные заливки, белые яркие рамки.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Правила контента</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Любой пустой блок заменяется на empty-state с причиной и шагом действия.</p>
            <p>Кнопки всегда дают видимый фидбек: loading + изменение статуса.</p>
            <p>Сложные действия подтверждаются sheet/dialog, destructive всегда с confirm.</p>
            <p>Основной текст контрастный, secondary только для подсказок.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Компоненты</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-text2">
            <p>Card: мягкие поверхности, тонкий border-soft, без белой рамки.</p>
            <p>Input: surface-2 + ring sky 25%.</p>
            <p>Buttons: primary teal, event gold, secondary surface.</p>
            <p>List Item: минимум 44px, icon tile слева, chevron справа.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ссылки</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/theme-showcase" className="text-cyan underline underline-offset-2">Открыть Theme Showcase</Link>
            <Link href="/profile/me" className="block text-cyan underline underline-offset-2">Профиль</Link>
            <Link href="/events" className="block text-cyan underline underline-offset-2">Ивенты</Link>
            <Link href="/admin" className="block text-cyan underline underline-offset-2">Админка</Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
