import { Link } from '@inertiajs/react';

/**
 * Small pill button/link used for quick actions in the glass theme. Renders
 * an Inertia <Link> when `href` is given, otherwise a <button>.
 */
export default function PillButton({
    children,
    href,
    onClick,
    primary = false,
    disabled = false,
    className = '',
    ariaLabel,
}) {
    const classes =
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[11.5px] font-bold transition ' +
        (primary
            ? 'bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90'
            : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink)] hover:border-[var(--accent)]') +
        (disabled ? ' pointer-events-none opacity-40' : '') +
        ' ' +
        className;

    if (href) {
        return (
            <Link
                href={href}
                className={classes}
                aria-label={ariaLabel}
                title={ariaLabel}
            >
                {children}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={classes}
            aria-label={ariaLabel}
            title={ariaLabel}
        >
            {children}
        </button>
    );
}
