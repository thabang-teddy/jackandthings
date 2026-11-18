import { Link } from "@inertiajs/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "bg-prim text-prim-ink hover:bg-accent hover:text-on-accent",
  secondary: "border border-text hover:bg-tint",
  ghost: "hover:bg-tint",
  danger: "bg-neg text-bg",
  live: "bg-live text-[#0A1A1A] hover:brightness-95",
} as const;
const sizes = { md: "h-10 px-4 text-sm", sm: "h-8 px-3 text-[13px]", lg: "h-12 px-6 text-base" } as const;

export type Variant = keyof typeof variants;
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean };

const base = "inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold disabled:opacity-40 whitespace-nowrap";

export function Button({ variant = "primary", size = "md", loading, children, className = "", type = "button", ...rest }: Props) {
  return (
    <button {...rest} type={type} disabled={rest.disabled || loading} aria-busy={loading || undefined}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/** A link that looks like a button (navigation, not an action). */
export function ButtonLink({ href, variant = "secondary", size = "md", children, className = "" }:
  { href: string; variant?: Variant; size?: keyof typeof sizes; children: ReactNode; className?: string }) {
  return <Link href={href} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>{children}</Link>;
}
