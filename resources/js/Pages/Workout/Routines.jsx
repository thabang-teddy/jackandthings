import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { router } from '@inertiajs/react';
import WorkoutRoutinesView from './RoutinesView';

export default function Routines({ routines = [], exercises = [] }) {
    const destroy = (routine) => {
        if (
            window.confirm(
                `Delete "${routine.name}"? Workouts already logged from it are kept.`,
            )
        ) {
            router.delete(route('workouts.routines.destroy', routine.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutRoutinesView
            routines={routines}
            exercises={exercises}
            onDelete={destroy}
        />
    );
}

Routines.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
