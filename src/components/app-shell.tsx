import type { ReactNode } from "react";
import { AppSessionTracker } from "@/components/app-session-tracker";
import { BottomTabs } from "@/components/bottom-tabs";

export function AppShell({
  children,
  withTabs = true,
  className,
}: {
  children: ReactNode;
  withTabs?: boolean;
  className?: string;
}) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-4 lg:max-w-xl xl:max-w-2xl">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-18%] top-[-10%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.22),transparent_66%)]" />
        <div className="absolute right-[-12%] top-[2%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgb(var(--violet-rgb)/0.24),transparent_68%)]" />
        <div className="absolute bottom-[6%] right-[4%] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.12),transparent_70%)]" />
      </div>

      <div className={className}>
        <AppSessionTracker />
        {children}
      </div>

      {withTabs ? <BottomTabs /> : null}
    </div>
  );
}
