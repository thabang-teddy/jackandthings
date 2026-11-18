/** A small radio group drawn as joined buttons (7 days / 30 days, Out / In). */
export function Segmented<T extends string | number>({ label, value, options, onChange }:
  { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-text">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`h-9 px-3.5 text-[13px] font-semibold ${o.value === value ? "bg-prim text-prim-ink" : "hover:bg-tint"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
