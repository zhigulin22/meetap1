import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  hint,
  cta,
  secondary,
}: {
  title: string;
  description: string;
  hint?: string;
  cta?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.98)] p-5 shadow-soft">
      <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-[radial-gradient(circle_at_30%_30%,rgb(var(--peach-rgb)/0.34),transparent_60%),radial-gradient(circle_at_75%_25%,rgb(var(--teal-rgb)/0.24),transparent_62%),radial-gradient(circle_at_50%_85%,rgb(var(--sky-rgb)/0.2),transparent_68%)]" />
      <h3 className="text-center text-base font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-center text-sm text-text2">{description}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-center text-xs text-text3">{hint}</p> : null}

      {cta || secondary ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {cta ? <Button onClick={cta.onClick}>{cta.label}</Button> : null}
          {secondary ? (
            <Button variant="secondary" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
