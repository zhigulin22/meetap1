"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Beaker,
  Bot,
  ChartColumnIncreasing,
  Activity,
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
  Workflow,
  FileBarChart2,
  UserCog,
  Megaphone,
  LifeBuoy,
  ScrollText,
  Settings2,
  Wrench,
  Database,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { roleHasPermission } from "@/lib/admin-rbac";

export type AdminSection =
  | "overview"
  | "guide"
  | "operations"
  | "metrics_lab"
  | "events_live"
  | "traffic"
  | "funnels"
  | "retention"
  | "experiments"
  | "flags"
  | "alerts"
  | "users"
  | "support"
  | "audit"
  | "config"
  | "data_quality"
  | "exports"
  | "rbac"
  | "risk"
  | "reports"
  | "moderation"
  | "assistant"
  | "system"
  | "integrations"
  | "security"
  | "backup"
  | "campaigns";

export type AdminSegment = "all" | "demo" | "real" | "verified" | "new" | "active";

function isSectionAllowed(role: string | null, section: AdminSection) {
  if (!role) return true;
  if (["guide"].includes(section)) return true;
  if (["overview", "operations", "metrics_lab", "funnels", "retention", "data_quality", "assistant", "campaigns"].includes(section)) {
    return roleHasPermission(role, "metrics.read");
  }
  if (["events_live", "users", "support"].includes(section)) {
    return roleHasPermission(role, "users.read");
  }
  if (["reports", "risk", "moderation"].includes(section)) {
    return roleHasPermission(role, "reports.read") || roleHasPermission(role, "risk.read");
  }
  if (["config", "flags", "system"].includes(section)) {
    return roleHasPermission(role, "config.manage");
  }
  if (section === "experiments") return roleHasPermission(role, "experiments.manage");
  if (section === "alerts") return roleHasPermission(role, "config.manage");
  if (section === "exports") return roleHasPermission(role, "exports.aggregate");
  if (section === "rbac") return roleHasPermission(role, "rbac.view");
  if (section === "traffic") return roleHasPermission(role, "traffic.manage");
  if (section === "integrations") return roleHasPermission(role, "integrations.manage");
  if (["security", "backup", "audit"].includes(section)) return roleHasPermission(role, "security.manage") || roleHasPermission(role, "rbac.view");
  return true;
}

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: AdminSection; title: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    title: "Monitoring",
    items: [
      { id: "overview", title: "Overview", icon: Gauge },
      { id: "operations", title: "Operations", icon: Workflow },
      { id: "metrics_lab", title: "Metrics Lab", icon: ChartColumnIncreasing },
      { id: "funnels", title: "Funnels", icon: ChartColumnIncreasing },
      { id: "retention", title: "Cohorts", icon: Sparkles },
      { id: "events_live", title: "Events Live", icon: Activity },
      { id: "traffic", title: "Traffic", icon: Activity },
      { id: "alerts", title: "Alerts", icon: BellRing },
    ],
  },
  {
    title: "Users & Trust",
    items: [
      { id: "users", title: "Users 360", icon: Users },
      { id: "reports", title: "Reports", icon: Flag },
      { id: "risk", title: "Risk Center", icon: ShieldAlert },
      { id: "moderation", title: "Moderation", icon: Shield },
      { id: "support", title: "Support Desk", icon: LifeBuoy },
    ],
  },
  {
    title: "Content & Events",
    items: [
      { id: "events_live", title: "Events Moderation", icon: Activity },
    ],
  },
  {
    title: "Product Ops",
    items: [
      { id: "flags", title: "Feature Flags", icon: SlidersHorizontal },
      { id: "experiments", title: "Experiments", icon: Beaker },
      { id: "config", title: "Config Center", icon: Settings2 },
      { id: "assistant", title: "AI Assistant", icon: Bot },
      { id: "integrations", title: "Integrations", icon: Plug },
      { id: "campaigns", title: "Campaigns", icon: Megaphone },
    ],
  },
  {
    title: "Governance & Security",
    items: [
      { id: "audit", title: "Admin Audit", icon: ScrollText },
      { id: "rbac", title: "RBAC & Admins", icon: UserCog },
      { id: "data_quality", title: "Data Quality", icon: FileBarChart2 },
      { id: "exports", title: "Exports & Snapshots", icon: HardDriveDownload },
      { id: "security", title: "Security", icon: ShieldAlert },
      { id: "backup", title: "Backups", icon: Database },
    ],
  },
  {
    title: "Guide",
    items: [{ id: "guide", title: "Как пользоваться", icon: LifeBuoy }],
  },
];

export function AdminShell({
  section,
  onSectionChange,
  onSearch,
  search,
  children,
  dateRange,
  onDateRangeChange,
  segment,
  onSegmentChange,
  onAskAI,
  helpMode,
  onHelpModeChange,
  role,
}: {
  section: AdminSection;
  onSectionChange: (s: AdminSection) => void;
  onSearch: (q: string) => void;
  search?: string;
  children: React.ReactNode;
  dateRange: "7d" | "14d" | "30d" | "90d";
  onDateRangeChange: (d: "7d" | "14d" | "30d" | "90d") => void;
  segment: AdminSegment;
  onSegmentChange: (s: AdminSegment) => void;
  onAskAI: () => void;
  helpMode: boolean;
  onHelpModeChange: (next: boolean) => void;
  role: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SideNav = (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--violet-rgb)/0.2)] text-[rgb(var(--violet-rgb))]">
          <Wrench className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">MeetAp Admin</p>
          <p className="text-xs text-text3">Control Center</p>
        </div>
      </div>

      <div className="space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="rounded-2xl border border-border bg-surface2/70 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3">{group.title}</p>
            <div className="space-y-2">
              {group.items
                .filter((item) => isSectionAllowed(role, item.id))
                .map((item) => {
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
                        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition active:scale-[0.98]",
                        active
                          ? "bg-[linear-gradient(135deg,rgb(var(--blue-rgb)/0.18),rgb(var(--mint-rgb)/0.14))] text-text shadow-glow"
                          : "border-border bg-surface2/75 text-text2 hover:text-text",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-2xl border border-border bg-surface2/75 p-3 text-xs text-text2">
        <p>Project: {pathname}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-amber">
          <ShieldAlert className="h-3 w-3" /> Moderation guard ON
        </p>
      </div>

      <Link href="/feed" className="text-center text-xs text-blue underline underline-offset-2">
        Вернуться в продукт
      </Link>
    </div>
  );

  return (
    <div className="aurora-screen min-h-screen p-3 md:p-5">
      <div className="admin-grid gap-4">
        <aside className="hidden rounded-3xl panel-soft p-4 lg:block">{SideNav}</aside>

        <div className="min-w-0 space-y-4">
          <header className="sticky top-2 z-30 rounded-3xl panel-soft px-3 py-3 backdrop-blur-xl md:px-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_auto_auto_auto_auto] md:items-center">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
                  <Menu className="h-4 w-4" />
                </Button>
                <p className="font-display text-lg font-semibold">Admin Command</p>
              </div>

              <Input value={search ?? ""} onChange={(e) => onSearch(e.target.value)} placeholder="Поиск: user, event, report, message..." />

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
                onChange={(e) => onSegmentChange(e.target.value as AdminSegment)}
                className="admin-select"
              >
                <option value="all">Все (all)</option>
                <option value="demo">Demo</option>
                <option value="real">Real</option>
                <option value="verified">Верифицированные</option>
                <option value="new">Новые</option>
                <option value="active">Активные</option>
              </select>

              <Button onClick={onAskAI} className="tap-press">
                <Bot className="mr-1 h-4 w-4" /> AI
              </Button>

              <Button
                variant={helpMode ? "default" : "secondary"}
                onClick={() => onHelpModeChange(!helpMode)}
                className="tap-press"
                aria-pressed={helpMode}
                title="Показывает встроенные подсказки по метрикам и разделам"
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {helpMode ? "Help ON" : "Help OFF"}
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
