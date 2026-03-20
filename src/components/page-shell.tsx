import { BottomTabs } from "@/components/bottom-tabs";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-3 pb-28 pt-4 xl:max-w-lg">
      {children}
      <BottomTabs />
    </div>
  );
}
