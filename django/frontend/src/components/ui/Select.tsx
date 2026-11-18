import { useId, type SelectHTMLAttributes } from "react";

export type SelectOption = { value: string | number; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string; value: string | number; onChange: (v: string) => void; options: SelectOption[];
  error?: string; placeholder?: string; hideLabel?: boolean;
};

export function Select({ label, value, onChange, options, error, placeholder, hideLabel, className = "", ...rest }: Props) {
  const id = useId();
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[13px] font-semibold"}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`h-11 w-full rounded-[3px] border bg-surface2 px-2.5 text-[15px] ${error ? "border-2 border-neg" : "border-field"}`}
        {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p id={`${id}-err`} className="text-[13px] font-medium text-neg">{error}</p>}
    </div>
  );
}
