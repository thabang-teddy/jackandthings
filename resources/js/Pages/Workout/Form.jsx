import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { getSubmenuForSecondaryPage } from '@/Lib/glassNav';
import WorkoutGlassFormView from './GlassFormView';
import { useForm } from '@inertiajs/react';

export default function Form({ entry, presets = [] }) {
    const isEdit = Boolean(entry);

    const { data, setData, post, put, processing, errors } = useForm({
        activity: entry?.activity ?? '',
        logged_at: entry?.logged_at ?? '',
        notes: entry?.notes ?? '',
    });

    const submit = (event) => {
        event.preventDefault();

        if (isEdit) {
            put(route('workouts.update', entry.id));
        } else {
            post(route('workouts.store'));
        }
    };

    return (
        <WorkoutGlassFormView
            isEdit={isEdit}
            data={data}
            setData={setData}
            errors={errors}
            processing={processing}
            onSubmit={submit}
            presets={presets}
        />
    );
}

Form.layout = (page) => (
    <AuthenticatedLayout
        module="workout"
        submenu={getSubmenuForSecondaryPage('workout', 'workouts.index')}
    >
        {page}
    </AuthenticatedLayout>
);
