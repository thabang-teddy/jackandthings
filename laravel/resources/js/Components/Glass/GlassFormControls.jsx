/**
 * Dark-styled stand-ins for the Breeze form atoms, used only inside glass
 * views so the light-mode TextInput/select/PrimaryButton stay untouched.
 */

const fieldClasses =
    'block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-0';

export function GlassLabel({ htmlFor, children }) {
    return (
        <label
            htmlFor={htmlFor}
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50"
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
                'inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#06121A] transition hover:bg-white/90 disabled:opacity-40 ' +
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

    return <p className="mt-1 text-xs text-rose-400">{message}</p>;
}
