import { PageShell } from "@/components/page-shell";

export default function EventSubmissionsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-6">
        <h1 className="text-2xl font-semibold">Мои заявки</h1>
        <p className="mt-2 text-sm text-text2">Список заявок появится после отправки события. Пока здесь пусто.</p>
      </div>
    </PageShell>
  );
}

