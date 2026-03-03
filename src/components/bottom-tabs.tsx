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
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-3 flex w-[calc(100%-24px)] max-w-md items-center justify-between rounded-[20px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.84)] px-2 py-1.5 shadow-soft backdrop-blur-2xl lg:max-w-xl xl:max-w-2xl">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "tap-press flex min-w-16 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] transition",
              active ? "text-[rgb(var(--teal-rgb))]" : "text-text3 hover:text-text2",
            )}
          >
            <span
              className={cn(
                "flex h-7 min-w-[42px] items-center justify-center rounded-full px-2",
                active ? "bg-[rgb(var(--mint-rgb)/0.14)] border border-[rgb(var(--teal-rgb)/0.24)]" : "bg-transparent",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
