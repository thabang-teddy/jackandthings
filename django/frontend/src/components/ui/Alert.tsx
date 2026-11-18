import type { ReactNode } from "react";

const tones = {
  error: "border-neg bg-neg-tint",
  warn: "border-warn bg-warn-tint",
  info: "border-accent bg-tint",
  success: "border-pos bg-pos-tint",
} as const;

export function Alert({ tone = "info", title, children }: { tone?: keyof typeof tones; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-l-[3px] px-4 py-3 text-[14.5px] ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

/** The form-level error from a view ("__all__"). */
export function FormError({ errors }: { errors: Record<string, string | undefined> }) {
  return errors.__all__ ? <Alert tone="error">{errors.__all__}</Alert> : null;
}
