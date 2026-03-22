import { AppShell } from "@/components/app-shell";

export function PageShell({ children, withTabs = true }: { children: React.ReactNode; withTabs?: boolean }) {
  return <AppShell withTabs={withTabs}>{children}</AppShell>;
}
