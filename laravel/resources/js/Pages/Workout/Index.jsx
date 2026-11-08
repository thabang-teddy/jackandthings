import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import WorkoutGlassIndexView from './GlassIndexView';
import { router } from '@inertiajs/react';

export default function Index({ entries, dueForReminder, lastLoggedAt }) {
    const destroy = (entry) => {
        if (window.confirm(`Delete "${entry.activity}"?`)) {
            router.delete(route('workouts.destroy', entry.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutGlassIndexView
            entries={entries}
            dueForReminder={dueForReminder}
            lastLoggedAt={lastLoggedAt}
            onDestroy={destroy}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
