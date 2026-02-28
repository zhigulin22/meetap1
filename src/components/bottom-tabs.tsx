"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, MessageCircle, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/feed", label: "Лента", icon: Home },
  { href: "/events", label: "Ивенты", icon: Calendar },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/contacts", label: "Люди", icon: Search },
  { href: "/profile/me", label: "Профиль", icon: User },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-3 flex w-[calc(100%-24px)] max-w-md items-center justify-around rounded-2xl border border-white/15 bg-[#09102fcc] px-2 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-2xl xl:max-w-lg">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] transition",
              active ? "bg-white/10 text-action" : "text-muted hover:text-text",
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
