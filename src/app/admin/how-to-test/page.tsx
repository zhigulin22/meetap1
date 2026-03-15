import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  "Открой /admin и перейди в раздел События (Live). Нажми Проверить трекинг и убедись, что появился admin_test_event.",
  "Перейди в Traffic Generator и нажми Start.",
  "Подожди 30-60 секунд или нажми Tick вручную несколько раз.",
  "Открой Воронки и проверь, что шаги auth.* и profile.completed растут.",
  "Открой Users 360 и включи фильтр demo, чтобы увидеть traffic пользователей.",
  "Открой Risk Center и включи chaos mode в Traffic Generator для аномальных сигналов.",
  "После теста нажми Stop.",
];

export default function AdminHowToTestPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Как тестировать админку</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {steps.map((step, idx) => (
            <div key={step} className="rounded-xl border border-border bg-surface2/70 p-3">
              <p>
                <strong>Шаг {idx + 1}.</strong> {step}
              </p>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/admin"><Button>Открыть Admin</Button></Link>
            <Link href="/admin/events-stream"><Button variant="secondary">Открыть Events Stream</Button></Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
