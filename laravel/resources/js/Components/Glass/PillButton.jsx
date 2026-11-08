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
}) {
    const classes =
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[11.5px] font-bold transition ' +
        (primary
            ? 'bg-white text-[#06121A] hover:bg-white/90'
            : 'border border-white/10 bg-white/5 text-white hover:bg-white/10') +
        (disabled ? ' pointer-events-none opacity-40' : '') +
        ' ' +
        className;

    if (href) {
        return (
            <Link href={href} className={classes}>
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
        >
            {children}
        </button>
    );
}
