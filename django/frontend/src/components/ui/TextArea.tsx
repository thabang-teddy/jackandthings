import { useId, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string; value: string; onChange: (v: string) => void; error?: string; hideLabel?: boolean;
};

export function TextArea({ label, value, onChange, error, hideLabel, rows = 4, className = "", ...rest }: Props) {
  const id = useId();
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[13px] font-semibold"}>{label}</label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className={`w-full rounded-[3px] border bg-surface2 px-3 py-2 text-[15px] leading-relaxed ${error ? "border-2 border-neg" : "border-field"}`}
        {...rest} />
      {error && <p id={`${id}-err`} className="text-[13px] font-medium text-neg">{error}</p>}
    </div>
  );
}
