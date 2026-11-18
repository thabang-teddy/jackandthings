import { formatZar } from "@/lib/money";

/** The cap meter: spent against cap, with a pace marker (how far through the month we are) and overflow. */
export function Meter({ label, spent, cap, pace, warn }:
  { label: string; spent: number; cap: number; pace: number; warn?: boolean }) {
  const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
  const over = Math.max(0, spent - cap);
  const tone = over > 0 ? "bg-neg" : warn ? "bg-warn" : "bg-text";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="num">
          {formatZar(spent)} <span className="text-muted">of {formatZar(cap)}</span>
          {over > 0 && <b className="ml-2 text-neg">{formatZar(over)} over</b>}
        </span>
      </div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={spent}
        aria-valuetext={`${formatZar(spent)} of ${formatZar(cap)}${over ? `, ${formatZar(over)} over` : ""}`}
        className="relative h-2.5 bg-line">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        <div aria-hidden title="Pace" className="absolute -top-1 h-[18px] w-0.5 bg-accent" style={{ left: `${Math.min(100, pace * 100)}%` }} />
      </div>
    </div>
  );
}

/** A plain progress bar (goals, sessions). */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 bg-line">
      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}
