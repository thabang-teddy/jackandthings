import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { router } from '@inertiajs/react';
import WorkoutSessionsView from './SessionsView';

export default function Sessions({ sessions = [], entries }) {
    const destroySession = (session) => {
        if (
            window.confirm(
                'Delete this workout? Its sets go with it, including any personal records set in it.',
            )
        ) {
            router.delete(route('workouts.sessions.destroy', session.id), {
                preserveScroll: true,
            });
        }
    };

    const destroyEntry = (entry) => {
        if (window.confirm(`Delete "${entry.activity}"?`)) {
            router.delete(route('workouts.destroy', entry.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutSessionsView
            sessions={sessions}
            entries={entries}
            onDeleteSession={destroySession}
            onDeleteEntry={destroyEntry}
        />
    );
}

Sessions.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
