import { router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SessionsCard from './SessionsCard';
import StatPill from '@/Components/Glass/StatPill';
import { formatHoursMinutes } from '@/Lib/formatDuration';
import { currentTimezone } from '@/Lib/pomodoroSessionLog';
import { useAnalyticsTimezone } from './useAnalyticsTimezone';

/**
 * The Sessions page: the intervals behind the analytics, newest first.
 *
 * Worth a page of its own rather than a card under a chart — a number you
 * cannot click into is hard to trust, and an interval logged by mistake needs
 * somewhere to be removed from.
 */
export default function Sessions({ sessions, today, timezone }) {
    useAnalyticsTimezone(timezone, ['sessions', 'today', 'timezone']);

    const destroy = (session) => {
        if (!window.confirm('Remove this session from your history?')) {
            return;
        }

        router.delete(route('pomodoro.sessions.destroy', session.id), {
            preserveScroll: true,
            data: { tz: currentTimezone() },
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                <StatPill
                    label="Focus today"
                    value={formatHoursMinutes(today.focus_seconds)}
                />
                <StatPill
                    label="Intervals today"
                    value={today.intervals}
                    dotColor="#4ADE80"
                />
                <StatPill
                    label="Listed"
                    value={sessions.length}
                    dotColor="#FBBF24"
                />
            </div>

            <SessionsCard sessions={sessions} onDelete={destroy} />
        </div>
    );
}

Sessions.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
