export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[rgba(88,110,168,0.22)] bg-[linear-gradient(140deg,rgba(9,15,36,0.98),rgba(16,11,40,0.98))] p-4">
      <div className="mb-3 h-44 animate-pulse rounded-2xl bg-[rgba(89,108,171,0.22)]" />
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[rgba(89,108,171,0.2)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[rgba(89,108,171,0.18)]" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-[rgba(89,108,171,0.18)]" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-10 animate-pulse rounded-xl bg-[rgba(89,108,171,0.2)]" />
        <div className="h-10 animate-pulse rounded-xl bg-[rgba(89,108,171,0.2)]" />
        <div className="h-10 animate-pulse rounded-xl bg-[rgba(89,108,171,0.2)]" />
      </div>
    </div>
  );
}
