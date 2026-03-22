"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
<<<<<<< HEAD
import { Calendar, Home, MessageCircle, Search, User } from "lucide-react";
=======
import { Calendar, Home, MessageSquare, Search, User } from "lucide-react";
>>>>>>> origin/develop-tema
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/feed", label: "Лента", icon: Home },
  { href: "/events", label: "Ивенты", icon: Calendar },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/contacts", label: "Люди", icon: Search },
  { href: "/messages", label: "Чаты", icon: MessageSquare },
  { href: "/profile/me", label: "Профиль", icon: User },
];

export function BottomTabs() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-3 flex w-[calc(100%-20px)] max-w-md items-center justify-between rounded-[24px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] px-2 py-2 shadow-[0_12px_30px_rgba(6,10,24,0.45)] backdrop-blur-2xl lg:max-w-xl xl:max-w-2xl">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
<<<<<<< HEAD
              "tap-press flex min-w-16 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] transition",
              active ? "text-text" : "text-text3 hover:text-text2",
=======
              "flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] transition",
              active ? "bg-white/10 text-action" : "text-muted hover:text-text",
>>>>>>> origin/develop-tema
            )}
          >
            <span
              className={cn(
                "flex h-8 min-w-[46px] items-center justify-center rounded-full px-2 transition",
                active
                  ? "bg-[image:var(--grad-primary)] text-white shadow-[0_0_18px_rgba(122,84,255,0.45)]"
                  : "bg-[rgb(var(--surface-2-rgb)/0.3)] text-text2",
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
