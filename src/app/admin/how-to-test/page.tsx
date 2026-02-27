import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  "Открой /admin и перейди в раздел События (Live). Нажми Проверить трекинг и убедись, что появился admin_test_event.",
  "Перейди в QA Bots и нажми Start QA Bots.",
  "Запусти runner на отдельной машине: npm run qa:bots с APP_BASE_URL, QA_BOTS_CONTROL_TOKEN, QA_BOTS_PASSWORD.",
  "Открой Воронки и убедись, что шаги auth.* и profile.completed растут.",
  "Открой Users 360, найди QA Bot 01 и проверь его последние действия.",
  "Открой Risk Center и включи mode=chaos у QA Bots, чтобы увидеть аномальные сигналы.",
  "После теста нажми Stop QA Bots.",
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
            <Link href="/admin"><Button variant="secondary">Открыть QA Bots</Button></Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
