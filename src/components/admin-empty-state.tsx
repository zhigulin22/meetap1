"use client";

import { Button } from "@/components/ui/button";

export function AdminEmptyState({
  why,
  action,
  where,
  actionLabel,
  onAction,
}: {
  why: string;
  action: string;
  where: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface2/70 p-3 text-sm">
      <p><span className="text-muted">Почему пусто:</span> {why}</p>
      <p className="mt-1"><span className="text-muted">Что сделать:</span> {action}</p>
      <p className="mt-1"><span className="text-muted">Где проверить:</span> {where}</p>
      {onAction && actionLabel ? (
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={onAction} className="active:scale-[0.98] transition-transform">{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
