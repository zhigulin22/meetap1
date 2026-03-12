import Link from "next/link";
import { ChevronRight, Shield, Smartphone, Bell, HeartHandshake, Sparkles, Trophy, HelpCircle, UserCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";

const items = [
  { href: "/settings/account", label: "Аккаунт", icon: UserCircle },
  { href: "/settings/profile", label: "Профиль", icon: Sparkles },
  { href: "/settings/privacy", label: "Конфиденциальность", icon: Shield },
  { href: "/settings/devices", label: "Устройства и сессии", icon: Smartphone },
  { href: "/settings/notifications", label: "Уведомления", icon: Bell },
  { href: "/settings/dating", label: "Настройки знакомств", icon: HeartHandshake },
  { href: "/settings/psychotest", label: "Психотест", icon: Sparkles },
  { href: "/settings/achievements", label: "Достижения", icon: Trophy },
  { href: "/settings/help", label: "Помощь", icon: HelpCircle },
];

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-xs text-muted">Все параметры вынесены в отдельные экраны</p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-4 py-3 text-sm text-text transition hover:bg-[rgb(var(--surface-3-rgb)/0.8)]"
          >
            <span className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-[rgb(var(--sky-rgb))]" />
              {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-text3" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

