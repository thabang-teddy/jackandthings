import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { getThemeVars } from '@/Lib/themeTokens';
import { useTheme } from '@/Lib/ThemeContext';

/**
 * Dialog in the glass design's two palettes. Headless UI portals it to the
 * end of <body>, outside the element that carries the theme's CSS custom
 * properties, so the panel applies its own copy of them — without that every
 * var(--token) resolves to nothing and the form renders see-through.
 */
export default function GlassModal({
    show = false,
    onClose = () => {},
    title,
    maxWidth = 'sm',
    children,
}) {
    const { theme } = useTheme();
    const vars = getThemeVars(theme);

    const maxWidthClass =
        {
            sm: 'sm:max-w-sm',
            md: 'sm:max-w-md',
            lg: 'sm:max-w-lg',
        }[maxWidth] ?? 'sm:max-w-sm';

    return (
        <Dialog
            open={show}
            onClose={onClose}
            className="relative z-50"
            aria-label={title}
        >
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0"
            />

            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel
                    transition
                    style={vars}
                    className={
                        'w-full rounded-[22px] border border-[var(--card-border)] bg-[var(--bg)] p-5 text-[var(--ink)] shadow-2xl transition duration-200 data-[closed]:scale-95 data-[closed]:opacity-0 ' +
                        maxWidthClass
                    }
                >
                    {title && (
                        <h2 className="mb-4 text-sm font-bold text-[var(--ink)]">
                            {title}
                        </h2>
                    )}
                    {children}
                </DialogPanel>
            </div>
        </Dialog>
    );
}
