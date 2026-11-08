import { Link } from '@inertiajs/react';
import GlassCard from '@/Components/Glass/GlassCard';
import LiveClock from '@/Components/Glass/LiveClock';
import {
    BarsIcon,
    ClockIcon,
    GridIcon,
    PlusIcon,
} from '@/Components/Glass/icons';

function QuickLink({ href, icon: Icon, label }) {
    return (
        <Link
            href={href}
            title={label}
            aria-label={label}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink)] transition hover:border-[var(--accent)]"
        >
            <Icon size={18} />
        </Link>
    );
}

export default function AuthenticatedView({
    notes,
    dueForReminder,
    lastLoggedAt,
}) {
    return (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-6 lg:flex-row">
            <GlassCard
                title="Quick notes"
                action={
                    <Link
                        href={route('notes.create')}
                        aria-label="New note"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
                    >
                        <PlusIcon size={12} />
                    </Link>
                }
                className="w-full lg:w-64"
            >
                {notes.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No notes yet.</p>
                ) : (
                    <div className="flex flex-col">
                        {notes.map((note) => (
                            <Link
                                key={note.id}
                                href={route('notes.edit', note.id)}
                                className="truncate py-1.5 text-sm text-[var(--ink)] hover:text-[var(--accent)]"
                            >
                                {note.title}
                            </Link>
                        ))}
                    </div>
                )}
                <Link
                    href={route('notes.index')}
                    className="mt-3 block text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                    All notes
                </Link>
            </GlassCard>

            <div className="flex flex-1 flex-col items-center gap-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                    Jack &amp; Things
                </p>
                <LiveClock className="text-6xl sm:text-7xl lg:text-8xl" />
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-2.5 text-sm">
                    <span className="text-[var(--muted)]">
                        {dueForReminder
                            ? 'Nothing logged this hour'
                            : `Last workout: ${lastLoggedAt ?? 'none yet'}`}
                    </span>
                    <Link
                        href={route('workouts.create')}
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Add Workout
                    </Link>
                </div>
            </div>

            <div className="flex gap-3 lg:flex-col">
                <QuickLink
                    href={route('budget.index')}
                    icon={BarsIcon}
                    label="Budget"
                />
                <QuickLink
                    href={route('pomodoro.index')}
                    icon={ClockIcon}
                    label="Pomodoro"
                />
                <QuickLink
                    href={route('dashboard')}
                    icon={GridIcon}
                    label="Dashboard"
                />
            </div>
        </div>
    );
}
