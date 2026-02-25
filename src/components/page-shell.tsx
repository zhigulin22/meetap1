import { BottomTabs } from "@/components/bottom-tabs";

export function PageShell({ children, withTabs = true }: { children: React.ReactNode; withTabs?: boolean }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-3 pb-28 pt-4 lg:max-w-xl xl:max-w-2xl">
      {children}
      {withTabs ? <BottomTabs /> : null}
    </div>
  );
}
