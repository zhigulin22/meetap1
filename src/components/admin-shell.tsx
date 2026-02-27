"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Beaker,
  Bot,
  ChartColumnIncreasing,
  Activity,
  Database,
  Flag,
  Gauge,
  HardDriveDownload,
  Menu,
  Plug,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AdminSection =
  | "overview"
  | "metrics_lab"
  | "events_live"
  | "traffic"
  | "funnels"
  | "retention"
  | "experiments"
  | "flags"
  | "alerts"
  | "users"
  | "risk"
  | "reports"
  | "moderation"
  | "assistant"
  | "system"
  | "integrations"
  | "security"
  | "backup";

const items: Array<{ id: AdminSection; title: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", title: "Обзор", icon: Gauge },
  { id: "metrics_lab", title: "Метрики (Lab)", icon: ChartColumnIncreasing },
  { id: "events_live", title: "События (Live)", icon: Activity },
  { id: "traffic", title: "Traffic Generator", icon: Bot },
  { id: "funnels", title: "Воронки", icon: ChartColumnIncreasing },
  { id: "retention", title: "Когорты", icon: Sparkles },
  { id: "experiments", title: "Эксперименты", icon: Beaker },
  { id: "flags", title: "Фичи и конфиг", icon: SlidersHorizontal },
  { id: "alerts", title: "Алерты", icon: BellRing },
  { id: "users", title: "Users 360", icon: Users },
  { id: "risk", title: "Risk Center", icon: ShieldAlert },
  { id: "reports", title: "Жалобы", icon: Flag },
  { id: "moderation", title: "Модерация", icon: Shield },
  { id: "assistant", title: "AI Ассистент", icon: Bot },
  { id: "system", title: "System Settings", icon: Wrench },
  { id: "integrations", title: "Интеграции", icon: Plug },
  { id: "security", title: "Безопасность", icon: Database },
  { id: "backup", title: "Экспорт и backup", icon: HardDriveDownload },
];

export function AdminShell({
  children,
  section,
  onSectionChange,
  dateRange,
  onDateRangeChange,
  segment,
  onSegmentChange,
  onAskAI,
  search,
  onSearch,
}: {
  children: React.ReactNode;
  section: AdminSection;
  onSectionChange: (v: AdminSection) => void;
  dateRange: "7d" | "14d" | "30d" | "90d";
  onDateRangeChange: (v: "7d" | "14d" | "30d" | "90d") => void;
  segment: "all" | "verified" | "new" | "active";
  onSegmentChange: (v: "all" | "verified" | "new" | "active") => void;
  onAskAI: () => void;
  search: string;
  onSearch: (v: string) => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SideNav = (
    <div className="flex h-full flex-col gap-2">
      <div className="mb-3 rounded-2xl border border-border bg-surface2/85 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Control Center</p>
        <p className="font-display text-lg font-semibold text-text">Meetap Admin</p>
        <p className="text-xs text-muted">growth · safety · product</p>
      </div>

      {items.map((item) => {
        const Icon = item.icon;
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSectionChange(item.id);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
              active
                ? "border-cyan/40 bg-[linear-gradient(135deg,#193968,#1e4a7f)] text-[#e3efff] shadow-glow"
                : "border-border bg-surface2/70 text-muted hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </button>
        );
      })}

      <div className="mt-auto rounded-2xl border border-border bg-surface2/70 p-3 text-xs text-muted">
        <p>Project: {pathname}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-[#ffb86b]">
          <Flag className="h-3 w-3" /> Reactive moderation ON
        </p>
      </div>

      <Link href="/feed" className="text-center text-xs text-cyan underline">
        Вернуться в продукт
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen p-3 md:p-5">
      <div className="admin-grid gap-4">
        <aside className="hidden rounded-3xl border border-border bg-surface p-4 lg:block">{SideNav}</aside>

        <div className="min-w-0 space-y-4">
          <header className="sticky top-2 z-30 rounded-3xl border border-border bg-surface px-3 py-3 shadow-soft backdrop-blur-xl md:px-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
                  <Menu className="h-4 w-4" />
                </Button>
                <p className="font-display text-lg font-semibold">Admin Command</p>
              </div>

              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Поиск: user, event, report, message..." />

              <select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value as "7d" | "14d" | "30d" | "90d")}
                className="admin-select"
              >
                <option value="7d">7 дней</option>
                <option value="14d">14 дней</option>
                <option value="30d">30 дней</option>
                <option value="90d">90 дней</option>
              </select>

              <select
                value={segment}
                onChange={(e) => onSegmentChange(e.target.value as "all" | "verified" | "new" | "active")}
                className="admin-select"
              >
                <option value="all">Все пользователи</option>
                <option value="verified">Верифицированные</option>
                <option value="new">Новые</option>
                <option value="active">Активные</option>
              </select>

              <Button onClick={onAskAI}>
                <Bot className="mr-1 h-4 w-4" /> AI
              </Button>
            </div>
          </header>

          <main className="grid grid-cols-12 gap-4">{children}</main>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetHeader>
          <SheetTitle>Навигация</SheetTitle>
        </SheetHeader>
        <div className="pt-2">{SideNav}</div>
      </Sheet>
    </div>
  );
}
