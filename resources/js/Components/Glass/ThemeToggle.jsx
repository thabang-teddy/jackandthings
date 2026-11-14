import { useTheme } from '@/Lib/ThemeContext';

/** Switches between the light and glass palettes of the one design. */
export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isGlass = theme === 'glass';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isGlass ? 'Switch to light theme' : 'Switch to glass theme'}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]"
        >
            <span
                className={
                    'relative inline-flex h-4 w-8 shrink-0 rounded-full transition ' +
                    (isGlass ? 'bg-emerald-400' : 'bg-black/15')
                }
            >
                <span
                    className={
                        'absolute top-0.5 h-3 w-3 rounded-full bg-white transition ' +
                        (isGlass ? 'left-4' : 'left-0.5')
                    }
                />
            </span>
            {isGlass ? 'Glass' : 'Light'}
        </button>
    );
}
