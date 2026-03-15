export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import CreateEventClient from "./CreateEventClient";

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold">Добавить событие</h1>
              <p className="text-xs text-muted">Загружаем форму...</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-5">
              <div className="h-40 animate-pulse rounded-2xl bg-[rgb(var(--surface-3-rgb)/0.5)]" />
            </div>
          </div>
        </PageShell>
      }
    >
      <CreateEventClient />
    </Suspense>
  );
}
