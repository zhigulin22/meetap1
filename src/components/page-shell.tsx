import { AppSessionTracker } from "@/components/app-session-tracker";
import { BottomTabs } from "@/components/bottom-tabs";

export function PageShell({ children, withTabs = true }: { children: React.ReactNode; withTabs?: boolean }) {
  return (
    <div className="aurora-screen mx-auto min-h-screen w-full max-w-md px-3 pb-28 pt-4 lg:max-w-xl xl:max-w-2xl">
      <AppSessionTracker />
      {children}
      {withTabs ? <BottomTabs /> : null}
    </div>
  );
}
