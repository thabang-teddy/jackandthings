import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import HistoryGlassView from './GlassView';
import { router, useForm } from '@inertiajs/react';

export default function Index({ entries, retentionDays }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        url: '',
        title: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('history.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    const destroy = (entry) => {
        router.delete(route('history.destroy', entry.id), {
            preserveScroll: true,
        });
    };

    return (
        <HistoryGlassView
            entries={entries}
            retentionDays={retentionDays}
            formState={{ data, setData, errors, processing }}
            onSubmit={submit}
            onDestroy={destroy}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="history">{page}</AuthenticatedLayout>
);
