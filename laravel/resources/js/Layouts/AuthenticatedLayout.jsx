import GlassShell from '@/Components/Glass/GlassShell';

/**
 * The app's one layout. GlassShell renders the rail + submenu chrome in
 * whichever of the two palettes (light/glass) the user has chosen — see
 * Lib/ThemeContext and Lib/themeTokens.
 */
export default function AuthenticatedLayout({
    header,
    module,
    title,
    submenu,
    activeAnchor,
    children,
}) {
    return (
        <GlassShell
            module={module}
            title={title}
            header={header}
            submenu={submenu}
            activeAnchor={activeAnchor}
        >
            {children}
        </GlassShell>
    );
}
