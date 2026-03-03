"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/feed", label: "Лента", icon: Home },
  { href: "/events", label: "Ивенты", icon: Calendar },
  { href: "/contacts", label: "Люди", icon: Search },
  { href: "/profile/me", label: "Профиль", icon: User },
];

export function BottomTabs() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-3 flex w-[calc(100%-24px)] max-w-md items-center justify-around rounded-[var(--radius-lg)] border border-border bg-[rgb(var(--surface-1-rgb)/0.9)] px-2 py-2 shadow-soft backdrop-blur-2xl lg:max-w-xl xl:max-w-2xl">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "tap-press flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] transition-colors",
              active
                ? "bg-[linear-gradient(135deg,rgb(var(--teal-rgb)/0.16),rgb(var(--sky-rgb)/0.12))] text-mint"
                : "text-text3 hover:text-text",
            )}
          >
            <Icon className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
