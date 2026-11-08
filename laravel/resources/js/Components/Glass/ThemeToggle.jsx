import { useTheme } from '@/Lib/ThemeContext';

/**
 * Toggles between the light Breeze theme and the glass theme. Styled
 * differently depending on which chrome it's currently sitting in.
 */
export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isGlass = theme === 'glass';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isGlass ? 'Switch to light theme' : 'Switch to glass theme'}
            className={
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ' +
                (isGlass
                    ? 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                    : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700')
            }
        >
            <span
                className={
                    'relative inline-flex h-4 w-8 shrink-0 rounded-full transition ' +
                    (isGlass
                        ? 'bg-emerald-400'
                        : 'bg-gray-300 dark:bg-gray-600')
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
