import GlassShell from '@/Components/Glass/GlassShell';
import { PomodoroTimerProvider } from '@/Lib/PomodoroTimerContext';
import { useWorkoutNudge } from '@/Lib/useWorkoutNudge';

/**
 * The app's one layout. GlassShell renders the rail + submenu chrome in
 * whichever of the two palettes (light/glass) the user has chosen — see
 * Lib/ThemeContext and Lib/themeTokens. It also renders the floating
 * Pomodoro ring itself, since it needs to sit inside GlassShell's own themed
 * div to pick up the CSS custom properties that div sets.
 *
 * Every page assigns this same component via `Page.layout`, which is what
 * makes Inertia treat it as a persistent layout: React keeps it (and the
 * PomodoroTimerProvider inside it) mounted across page navigations instead of
 * tearing it down and rebuilding it, so a running Pomodoro timer survives the
 * trip from one page to another.
 */
export default function AuthenticatedLayout({
    header,
    module,
    title,
    submenu,
    activeAnchor,
    children,
}) {
    // Mounted here rather than per page for the same reason the timer is:
    // the layout survives Inertia navigations, so the hourly check is not
    // restarted every time the user moves between modules.
    useWorkoutNudge(route('workouts.due'));

    return (
        <PomodoroTimerProvider>
            <GlassShell
                module={module}
                title={title}
                header={header}
                submenu={submenu}
                activeAnchor={activeAnchor}
            >
                {children}
            </GlassShell>
        </PomodoroTimerProvider>
    );
}
