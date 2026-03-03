"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-[rgb(16_34_28/0.24)] backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div
        className={cn(
          "sheet-enter fixed inset-x-0 bottom-0 max-h-[90vh] w-full rounded-t-[28px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] p-4 shadow-soft md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[rgb(var(--border-strong-rgb)/0.82)] md:hidden" />
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-3">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-lg font-semibold text-text">{children}</h3>;
}
