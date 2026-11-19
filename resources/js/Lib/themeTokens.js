/**
 * CSS custom properties for the app's one design, in its two palettes.
 * GlassShell applies these as inline styles on its root element; every
 * descendant reads them via var(--token) so no component needs to branch
 * on theme itself.
 *
 * Two entries are not custom properties and are here deliberately:
 *
 * `colorScheme` tells the browser which way round the UI is, which is the
 * only way to influence the parts of a form control the page does not draw —
 * a <select>'s popup list, its arrow, scrollbars. Without it the browser
 * assumes light and paints a white popup, so the near-white `--ink` the
 * options inherit lands on white and disappears. It is set here rather than
 * on <html> on purpose: the Breeze-styled Profile and auth pages are always
 * light, and darkening their controls from the glass theme would be wrong.
 *
 * `--field-*` are the opaque pair those popups need. The card tokens cannot
 * serve: `--card-bg` is barely-there white that only reads as dark because of
 * what is behind it, and an OS-drawn popup has nothing behind it.
 */
export function getThemeVars(theme) {
    if (theme === 'light') {
        return {
            colorScheme: 'light',
            '--field-bg': '#FFFFFF',
            '--field-ink': '#141A2E',
            '--bg': '#F2F5FB',
            '--ink': '#141A2E',
            '--muted': 'rgba(20,26,46,0.55)',
            '--card-bg': 'rgba(255,255,255,0.65)',
            '--card-border': 'rgba(20,26,46,0.08)',
            '--rail-bg': 'rgba(255,255,255,0.7)',
            '--rail-border': 'rgba(20,26,46,0.08)',
            '--rail-icon': 'rgba(20,26,46,0.35)',
            '--accent': '#2B6CFF',
            '--accent-ink': '#FFFFFF',
            '--pos': '#059669',
            '--neg': '#E11D48',
            '--glow-1': '#2B6CFF',
            '--glow-2': '#17D9D4',
            '--glow-opacity': '0.16',
            '--warn-bg': 'rgba(245,158,11,0.14)',
            '--warn-border': 'rgba(217,119,6,0.35)',
            '--warn-ink': '#92400E',
            '--warn-muted': 'rgba(146,64,14,0.75)',
        };
    }

    return {
        colorScheme: 'dark',
        // Opaque, and a shade lighter than --bg so an open popup reads as
        // sitting above the page rather than cut out of it.
        '--field-bg': '#161C2F',
        '--field-ink': '#EAF0FF',
        '--bg': '#0A0F1E',
        '--ink': '#EAF0FF',
        '--muted': 'rgba(234,240,255,0.5)',
        '--card-bg': 'rgba(255,255,255,0.045)',
        '--card-border': 'rgba(255,255,255,0.09)',
        '--rail-bg': 'rgba(255,255,255,0.05)',
        '--rail-border': 'rgba(255,255,255,0.08)',
        '--rail-icon': 'rgba(234,240,255,0.4)',
        '--accent': '#2B6CFF',
        '--accent-ink': '#06121A',
        '--pos': '#34D399',
        '--neg': '#FB7185',
        '--glow-1': '#2B6CFF',
        '--glow-2': '#17D9D4',
        '--glow-opacity': '0.35',
        '--warn-bg': 'rgba(245,158,11,0.12)',
        '--warn-border': 'rgba(245,158,11,0.3)',
        '--warn-ink': '#FCD34D',
        '--warn-muted': 'rgba(252,211,77,0.75)',
    };
}
