/** A switch: a real button with role="switch", so keyboards and screen readers get it for free. */
export function Toggle({ label, checked, onChange, hint, disabled }:
  { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${checked ? "border-accent bg-accent" : "border-field bg-surface2"}`}>
        <span aria-hidden className={`absolute top-0.5 size-[18px] rounded-full transition-all ${checked ? "left-[22px] bg-on-accent" : "left-0.5 bg-field"}`} />
      </button>
    </div>
  );
}
