import type { ReactNode } from "react";

export function Checkbox({ label, checked, onChange, hint }:
  { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-[18px] accent-[var(--accent)]" />
      <span>{label}{hint && <span className="block text-[13px] text-muted">{hint}</span>}</span>
    </label>
  );
}
