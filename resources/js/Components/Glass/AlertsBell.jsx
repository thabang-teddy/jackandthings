import { BellIcon } from '@/Components/Glass/icons';
import { useDesktopAlerts } from '@/Lib/desktopAlerts';

/**
 * Turns desktop notifications on and off. The browser only shows its
 * permission prompt in response to a real click, so this control is the one
 * place that can ask for it — which is why it appears both in GlassShell's
 * header and on the home page, whose chrome is its own.
 */
export default function AlertsBell({ className = '' }) {
    const { supported, blocked, enabled, toggle } = useDesktopAlerts();

    if (!supported) {
        return null;
    }

    const label = blocked
        ? 'Desktop alerts are blocked for this site in your browser settings'
        : enabled
          ? 'Desktop alerts on — click to turn off'
          : 'Turn on desktop alerts for workout nudges and Pomodoro phases';

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={blocked}
            aria-pressed={enabled}
            aria-label={label}
            title={label}
            className={
                'flex h-9 w-9 items-center justify-center rounded-full border transition ' +
                (enabled
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--ink)]') +
                (blocked ? ' cursor-not-allowed opacity-50' : '') +
                (className ? ` ${className}` : '')
            }
        >
            <BellIcon size={15} />
        </button>
    );
}
