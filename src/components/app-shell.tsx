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
        <div className="absolute left-[-20%] top-[-12%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.18),transparent_64%)]" />
        <div className="absolute right-[-16%] top-[2%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgb(var(--teal-rgb)/0.18),transparent_66%)]" />
        <div className="absolute bottom-[6%] right-[6%] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgb(var(--sky-rgb)/0.1),transparent_68%)]" />
      </div>

      <div className={className}>
        <AppSessionTracker />
        {children}
      </div>

      {withTabs ? <BottomTabs /> : null}
    </div>
  );
}
