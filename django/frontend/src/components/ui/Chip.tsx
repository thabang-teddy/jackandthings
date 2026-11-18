import type { ReactNode } from "react";

/** A toggleable filter chip. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`h-8 rounded-full border px-3 text-[13px] font-medium ${selected ? "border-text bg-prim text-prim-ink" : "border-line hover:border-text"}`}>
      {children}
    </button>
  );
}
