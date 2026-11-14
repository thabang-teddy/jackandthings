import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { router } from '@inertiajs/react';
import WorkoutLibraryView from './LibraryView';

export default function Library({
    exercises = [],
    categories = [],
    metrics = [],
}) {
    const destroy = (exercise) => {
        if (window.confirm(`Delete "${exercise.name}"?`)) {
            router.delete(route('workouts.exercises.destroy', exercise.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutLibraryView
            exercises={exercises}
            categories={categories}
            metrics={metrics}
            onDelete={destroy}
        />
    );
}

Library.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
