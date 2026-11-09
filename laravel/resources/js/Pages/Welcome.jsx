import { Head } from '@inertiajs/react';
import AuthenticatedView from './Welcome/AuthenticatedView';
import GuestView from './Welcome/GuestView';
import { getThemeVars } from '@/Lib/themeTokens';
import { useTheme } from '@/Lib/ThemeContext';

export default function Welcome({
    auth,
    canLogin,
    notes,
    presets = [],
    dueForReminder,
    lastLoggedAt,
    defaultPreset,
}) {
    const { theme } = useTheme();
    const vars = getThemeVars(theme);

    return (
        <>
            <Head title="Welcome" />
            <div
                className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
                style={vars}
            >
                <div
                    className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-[70px]"
                    style={{
                        background: 'var(--glow-1)',
                        opacity: 'var(--glow-opacity)',
                        top: '-140px',
                        left: '-120px',
                    }}
                />
                <div
                    className="pointer-events-none absolute h-[380px] w-[380px] rounded-full blur-[70px]"
                    style={{
                        background: 'var(--glow-2)',
                        opacity: 'var(--glow-opacity)',
                        bottom: '-160px',
                        right: '-100px',
                    }}
                />

                {auth?.user ? (
                    <AuthenticatedView
                        notes={notes}
                        presets={presets}
                        dueForReminder={dueForReminder}
                        lastLoggedAt={lastLoggedAt}
                        defaultPreset={defaultPreset}
                    />
                ) : (
                    <GuestView canLogin={canLogin} />
                )}
            </div>
        </>
    );
}
