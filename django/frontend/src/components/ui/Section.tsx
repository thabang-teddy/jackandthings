import type { ReactNode } from "react";

/** A Daybook section: 2 px top rule, a small-caps kicker, optional action on the right. */
export function Section({ kicker, title, action, children, className = "" }:
  { kicker: string; title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rule pt-3 ${className}`} aria-label={title ?? kicker}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="kicker">{kicker}</p>
          {title && <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight">{title}</h2>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border-l border-line pl-4">
      <p className="kicker">{label}</p>
      <p className="num mt-1 font-serif text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
    </div>
  );
}
