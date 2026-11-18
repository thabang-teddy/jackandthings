/** Accessible by construction: sighted users read the bars and labels; screen readers get a real table. */
export function BarChart({ caption, items, height = 160 }:
  { caption: string; items: { label: string; value: number; display: string; highlight?: boolean }[]; height?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure aria-label={caption}>
      <div className="flex items-end gap-3.5 border-b-[1.5px] border-text pt-6" style={{ height }} aria-hidden>
        {items.map((i) => (
          <div key={i.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className={`num text-xs ${i.highlight ? "font-bold text-accent" : ""}`}>{i.value ? i.display : ""}</span>
            <div className={`w-full max-w-[46px] ${i.highlight ? "bg-accent" : "bg-text"}`} style={{ height: `${(i.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3.5 text-xs text-muted" aria-hidden>
        {items.map((i) => <span key={i.label} className="flex-1 text-center">{i.label}</span>)}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>{items.map((i) => <tr key={i.label}><th>{i.label}</th><td>{i.display}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for "by category / by project" lists. */
export function HBars({ caption, items }: { caption: string; items: { label: string; value: number; display: string; colour?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure aria-label={caption}>
      <ul className="grid gap-3" aria-hidden>
        {items.map((i) => (
          <li key={i.label} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="h-2.5 bg-line"><span className="block h-full" style={{ width: `${(i.value / max) * 100}%`, background: i.colour ?? "var(--text)" }} /></span>
            <span className="num text-right">{i.display}</span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>{items.map((i) => <tr key={i.label}><th>{i.label}</th><td>{i.display}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
