import { Head, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import AlertsBell from '@/Components/Glass/AlertsBell';
import PomodoroFloatingRing from '@/Components/Glass/PomodoroFloatingRing';
import Rail from '@/Components/Glass/Rail';
import SubmenuPills from '@/Components/Glass/SubmenuPills';
import ThemeToggle from '@/Components/Glass/ThemeToggle';
import WorkoutRestPill from '@/Components/Glass/WorkoutRestPill';
import { getModule, getSubmenu } from '@/Lib/glassNav';
import { getThemeVars } from '@/Lib/themeTokens';
import { useTheme } from '@/Lib/ThemeContext';

export default function GlassShell({
    module,
    title,
    header,
    submenu,
    activeAnchor,
    children,
}) {
    const { auth, flash } = usePage().props;
    const { theme } = useTheme();
    const vars = getThemeVars(theme);
    const moduleInfo = getModule(module);
    const items = submenu ?? getSubmenu(module);
    const initials = (auth.user.name || '?')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div
            className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
            style={vars}
        >
            <Head title={title ?? moduleInfo?.label ?? 'Jack & Things'} />

            <div
                className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-[70px]"
                style={{
                    background: 'var(--glow-1)',
                    opacity: 'var(--glow-opacity)',
                    top: '-140px',
                    left: '260px',
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

            <div className="relative z-10 flex min-h-screen gap-4 p-6">
                <Rail active={module} />

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex items-center gap-3">
                        {header ? (
                            <div className="[&_*]:!text-[var(--ink)]">
                                {header}
                            </div>
                        ) : (
                            (title || moduleInfo) && (
                                <h1 className="text-lg font-bold">
                                    {title ?? moduleInfo.label}
                                </h1>
                            )
                        )}
                        <div className="ml-auto flex items-center gap-2.5">
                            {items.length > 0 && (
                                <SubmenuPills
                                    items={items}
                                    activeAnchor={activeAnchor}
                                />
                            )}
                            <ThemeToggle />
                            <AlertsBell />
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-[var(--accent-ink)]"
                                    >
                                        {initials || 'U'}
                                    </button>
                                </Dropdown.Trigger>
                                <Dropdown.Content>
                                    <Dropdown.Link href={route('profile.edit')}>
                                        Profile
                                    </Dropdown.Link>
                                    <Dropdown.Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                    >
                                        Log Out
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>
                    </div>

                    {flash?.status && (
                        <div
                            className="rounded-2xl px-4 py-3 text-sm"
                            style={{
                                border: '1px solid rgba(16,185,129,0.25)',
                                background: 'rgba(16,185,129,0.12)',
                                color: 'var(--pos)',
                            }}
                        >
                            {flash.status}
                        </div>
                    )}

                    <div className="min-h-0 flex-1">{children}</div>
                </div>
            </div>

            {/* A sibling of the flex content above rather than nested in it,
                so its own fixed positioning isn't affected by that layout —
                but still inside this div, which is what carries the theme's
                CSS custom properties via `style={vars}` above. */}
            <PomodoroFloatingRing />
            <WorkoutRestPill />
        </div>
    );
}
