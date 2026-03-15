import Link from "next/link";
import { Bell, ChevronRight, Globe, HeartHandshake, HelpCircle, Palette, Shield, Smartphone, Sparkles, Trophy, UserCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";

const sections = [
  {
    title: "Основные",
    items: [
      { href: "/settings/account", label: "Аккаунт", hint: "Имя, username, почта, пароль", icon: UserCircle, color: "rgb(var(--sky-rgb))" },
      { href: "/settings/profile", label: "Профиль", hint: "Фото, био, интересы, факты", icon: Sparkles, color: "rgb(var(--violet-rgb))" },
      { href: "/settings/notifications", label: "Уведомления", hint: "События, сообщения, коннекты", icon: Bell, color: "rgb(var(--gold-rgb))" },
      { href: "/settings/appearance", label: "Оформление", hint: "Тема и визуальные настройки", icon: Palette, color: "rgb(var(--violet-rgb))" },
      { href: "/settings/language", label: "Язык", hint: "Язык интерфейса", icon: Globe, color: "rgb(var(--sky-rgb))" },
    ],
  },
  {
    title: "Безопасность",
    items: [
      { href: "/settings/privacy", label: "Конфиденциальность", hint: "Кто видит данные и может писать", icon: Shield, color: "rgb(var(--teal-rgb))" },
      { href: "/settings/devices", label: "Устройства и сессии", hint: "Активные входы и выход", icon: Smartphone, color: "rgb(var(--sky-rgb))" },
    ],
  },
  {
    title: "Знакомства",
    items: [
      { href: "/settings/dating", label: "Настройки знакомств", hint: "Режим и предпочтения", icon: HeartHandshake, color: "rgb(var(--teal-rgb))" },
      { href: "/settings/psychotest", label: "Психотест", hint: "Улучшает рекомендации", icon: Sparkles, color: "rgb(var(--violet-rgb))" },
      { href: "/settings/achievements", label: "Достижения", hint: "Долгие бейджи и прогресс", icon: Trophy, color: "rgb(var(--gold-rgb))" },
    ],
  },
  {
    title: "Поддержка",
    items: [
      { href: "/settings/help", label: "Помощь", hint: "Инструкции и поддержка", icon: HelpCircle, color: "rgb(var(--sky-rgb))" },
    ],
  },
];

function SettingsRow({
  href,
  label,
  hint,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  hint: string;
  icon: typeof UserCircle;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-4 py-3 text-sm text-text transition hover:bg-[rgb(var(--surface-3-rgb)/0.8)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background: color.replace("rgb(", "rgba(").replace(")", ", 0.32)"),
            border: `1px solid ${color.replace("rgb(", "rgba(").replace(")", ", 0.5)")}`,
          }}
        >
          <span className="text-white">
            <Icon className="h-5 w-5" />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-text">{label}</span>
          <span className="block text-xs text-text3 truncate">{hint}</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-text3" />
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-xs text-text2">Все разделы — отдельные страницы, как в Telegram</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.7)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text3">{section.title}</p>
            <div className="space-y-2">
              {section.items.map((item) => (
                <SettingsRow key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
