import { Link, usePage } from '@inertiajs/react';
import { formatClock } from '@/Lib/formatClock';
import { useWorkoutRest } from '@/Lib/WorkoutRestContext';

/**
 * A small floating rest countdown that follows the signed-in user across every
 * page while a rest is running, the same job PomodoroFloatingRing does for a
 * focus interval.
 *
 * Without it the timer would keep ticking after a navigation but have nowhere
 * to show itself, so walking from Today to Sessions mid-workout would look
 * like the rest had stopped. Hidden on Today, where the full RestTimerBar is
 * already on screen with the same clock and the same controls.
 *
 * Offset above the Pomodoro ring rather than beside it: both can be running at
 * once, and two pills fighting for the same spot would overlap.
 */
export default function WorkoutRestPill() {
    const rest = useWorkoutRest();
    const { component } = usePage();

    if (!rest.running || component === 'Workout/Index') {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur">
                <Link
                    href={route('workouts.index')}
                    title={
                        rest.label
                            ? `Resting — next: ${rest.label}. Open Workout.`
                            : 'Resting — open Workout'
                    }
                    className="flex items-baseline gap-2"
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Rest
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-[var(--ink)]">
                        {formatClock(rest.secondsLeft)}
                    </span>
                </Link>

                <button
                    type="button"
                    onClick={() => rest.extend(30)}
                    title="Add 30 seconds"
                    aria-label="Add 30 seconds to the rest"
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--card-border)] hover:text-[var(--ink)]"
                >
                    +30s
                </button>
                <button
                    type="button"
                    onClick={rest.stop}
                    title="Skip the rest"
                    aria-label="Skip the rest"
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--card-border)] hover:text-[var(--ink)]"
                >
                    Skip
                </button>
            </div>
        </div>
    );
}
