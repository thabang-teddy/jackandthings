/**
 * Form atoms for the one design's two palettes — used by every module
 * instead of the Breeze TextInput/select/PrimaryButton (those stay reserved
 * for Profile/Auth, which this redesign doesn't touch).
 */

const fieldClasses =
    'block w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-0';

export function GlassLabel({ htmlFor, children }) {
    return (
        <label
            htmlFor={htmlFor}
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
            {children}
        </label>
    );
}

export function GlassInput({ className = '', ...props }) {
    return <input {...props} className={`${fieldClasses} ${className}`} />;
}

export function GlassSelect({ className = '', children, ...props }) {
    return (
        <select {...props} className={`${fieldClasses} ${className}`}>
            {children}
        </select>
    );
}

export function GlassTextarea({ className = '', ...props }) {
    return <textarea {...props} className={`${fieldClasses} ${className}`} />;
}

export function GlassButton({ className = '', disabled, children, ...props }) {
    return (
        <button
            {...props}
            disabled={disabled}
            className={
                'inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold uppercase tracking-wide text-[var(--accent-ink)] transition hover:opacity-90 disabled:opacity-40 ' +
                className
            }
        >
            {children}
        </button>
    );
}

export function GlassError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1 text-xs text-[var(--neg)]">{message}</p>;
}
