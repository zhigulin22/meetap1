import Link from "next/link";
import { Bell, ChevronRight, Globe, HeartHandshake, HelpCircle, Palette, Shield, Smartphone, Sparkles, Trophy, UserCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";

const items = [
  {
    href: "/settings/account",
    label: "Аккаунт",
    hint: "Имя, username, почта, пароль",
    icon: UserCircle,
    color: "rgb(var(--sky-rgb))",
  },
  {
    href: "/settings/profile",
    label: "Профиль",
    hint: "Фото, био, интересы, факты",
    icon: Sparkles,
    color: "rgb(var(--violet-rgb))",
  },
  {
    href: "/settings/privacy",
    label: "Конфиденциальность",
    hint: "Кто видит данные и может писать",
    icon: Shield,
    color: "rgb(var(--teal-rgb))",
  },
  {
    href: "/settings/devices",
    label: "Устройства и сессии",
    hint: "Активные входы и выход",
    icon: Smartphone,
    color: "rgb(var(--sky-rgb))",
  },
  {
    href: "/settings/notifications",
    label: "Уведомления",
    hint: "События, сообщения, коннекты",
    icon: Bell,
    color: "rgb(var(--gold-rgb))",
  },
  {
    href: "/settings/dating",
    label: "Настройки знакомств",
    hint: "Режим и предпочтения",
    icon: HeartHandshake,
    color: "rgb(var(--teal-rgb))",
  },
  {
    href: "/settings/psychotest",
    label: "Психотест",
    hint: "Улучшает рекомендации",
    icon: Sparkles,
    color: "rgb(var(--violet-rgb))",
  },
  {
    href: "/settings/achievements",
    label: "Достижения",
    hint: "Долгие бейджи и прогресс",
    icon: Trophy,
    color: "rgb(var(--gold-rgb))",
  },
  {
    href: "/settings/appearance",
    label: "Оформление",
    hint: "Светлая/тёмная тема",
    icon: Palette,
    color: "rgb(var(--violet-rgb))",
  },
  {
    href: "/settings/language",
    label: "Язык",
    hint: "Язык интерфейса",
    icon: Globe,
    color: "rgb(var(--sky-rgb))",
  },
  {
    href: "/settings/help",
    label: "Помощь",
    hint: "Инструкции и поддержка",
    icon: HelpCircle,
    color: "rgb(var(--sky-rgb))",
  },
];

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-xs text-muted">Каждый раздел на отдельной странице, как в Telegram</p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-4 py-3 text-sm text-text transition hover:bg-[rgb(var(--surface-3-rgb)/0.8)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background: item.color.replace("rgb(", "rgba(").replace(")", ", 0.18)"),
                  border: `1px solid ${item.color.replace("rgb(", "rgba(").replace(")", ", 0.35)")}`,
                }}
              >
                <item.icon className="h-5 w-5" style={{ color: item.color }} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text">{item.label}</span>
                <span className="block text-xs text-text3 truncate">{item.hint}</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-text3" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
