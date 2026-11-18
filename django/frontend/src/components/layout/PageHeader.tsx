import type { ReactNode } from "react";

export function PageHeader({ kicker, title, deck, actions }: { kicker: ReactNode; title: string; deck?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="kicker">{kicker}</p>
        <h1 className="mt-1 font-serif text-4xl font-medium tracking-tight md:text-5xl">{title}</h1>
        {deck && <p className="mt-2 max-w-2xl font-serif text-lg text-muted">{deck}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
