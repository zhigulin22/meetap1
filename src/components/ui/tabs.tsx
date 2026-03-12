"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextType = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.86)] p-1", className)} {...props} />;
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      className={cn(
        "rounded-[10px] px-3 py-1.5 text-sm transition-all duration-150 active:scale-[0.98]",
        active
          ? "border border-[rgb(var(--teal-rgb)/0.28)] bg-[image:var(--grad-primary)] text-white shadow-[0_0_16px_rgb(var(--teal-rgb)/0.25)]"
          : "text-text2 hover:text-text",
        className,
      )}
      onClick={() => ctx.setValue(value)}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div>{children}</div>;
}
