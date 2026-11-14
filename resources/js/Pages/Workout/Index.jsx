import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import WorkoutGlassIndexView from './GlassIndexView';
import { router } from '@inertiajs/react';

export default function Index({
    entries,
    presets = [],
    routines = [],
    exercises = [],
    openSession = null,
    dueForReminder,
    lastLoggedAt,
}) {
    const destroy = (entry) => {
        if (window.confirm(`Delete "${entry.activity}"?`)) {
            router.delete(route('workouts.destroy', entry.id), {
                preserveScroll: true,
            });
        }
    };

    const destroyPreset = (preset) => {
        if (window.confirm(`Delete preset "${preset.name}"?`)) {
            router.delete(route('workouts.presets.destroy', preset.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutGlassIndexView
            entries={entries}
            presets={presets}
            routines={routines}
            exercises={exercises}
            openSession={openSession}
            dueForReminder={dueForReminder}
            lastLoggedAt={lastLoggedAt}
            onDestroy={destroy}
            onDestroyPreset={destroyPreset}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
