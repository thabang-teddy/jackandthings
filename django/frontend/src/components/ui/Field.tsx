import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; hideLabel?: boolean;
};

export const inputClass = (error?: string) =>
  `h-11 w-full rounded-[3px] border bg-surface2 px-3 text-[15px] ${error ? "border-2 border-neg" : "border-field"}`;

export function Field({ label, value, onChange, error, hint, hideLabel, className = "", ...rest }: Props) {
  const id = useId();
  const help = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[13px] font-semibold"}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error} aria-describedby={help} className={inputClass(error)} {...rest} />
      {error ? <p id={`${id}-err`} className="text-[13px] font-medium text-neg">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

/** Money amounts: typed as text ("46,50"); the server parses them with parse_zar. */
export function AmountField(props: Props) {
  return <Field inputMode="decimal" autoComplete="off" placeholder="0,00" {...props} className={`num ${props.className ?? ""}`} />;
}
