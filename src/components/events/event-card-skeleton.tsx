export function EventCardSkeleton() {
  return (
    <div className="dual-edge overflow-hidden rounded-[24px] bg-[rgb(var(--surface-2-rgb)/0.92)] p-4">
      <div className="mb-3 h-44 animate-pulse rounded-2xl bg-[rgb(var(--surface-3-rgb)/0.66)]" />
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.64)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.58)]" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-[rgb(var(--surface-3-rgb)/0.58)]" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--surface-3-rgb)/0.62)]" />
        <div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--surface-3-rgb)/0.62)]" />
        <div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--surface-3-rgb)/0.62)]" />
      </div>
    </div>
  );
}
