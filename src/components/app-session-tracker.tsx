"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const SESSION_KEY = "meetap_session_started_at";

export function AppSessionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname || pathname.startsWith("/register") || pathname.startsWith("/login") || pathname.startsWith("/admin")) {
      return;
    }

    const current = window.sessionStorage.getItem(SESSION_KEY);
    if (current) return;

    window.sessionStorage.setItem(SESSION_KEY, new Date().toISOString());
    void track("app.session_start", { path: pathname });
  }, [pathname]);

  return null;
}
