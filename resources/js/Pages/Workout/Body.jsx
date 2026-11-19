import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { router } from '@inertiajs/react';
import WorkoutBodyView from './BodyView';

export default function Body({
    metrics = [],
    photos = [],
    sites = [],
    maxPhotoKilobytes = 8192,
}) {
    const destroyMetric = (metric) => {
        if (
            window.confirm(
                `Delete the reading for ${metric.measured_on}? Photos taken that day are kept.`,
            )
        ) {
            router.delete(route('workouts.body.destroy', metric.id), {
                preserveScroll: true,
            });
        }
    };

    const destroyPhoto = (photo) => {
        if (window.confirm('Delete this photo? The image file goes with it.')) {
            router.delete(route('progress-photos.destroy', photo.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <WorkoutBodyView
            metrics={metrics}
            photos={photos}
            sites={sites}
            maxPhotoKilobytes={maxPhotoKilobytes}
            onDeleteMetric={destroyMetric}
            onDeletePhoto={destroyPhoto}
        />
    );
}

Body.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
