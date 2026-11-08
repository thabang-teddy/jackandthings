import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import NotesGlassIndexView from './GlassIndexView';
import { router } from '@inertiajs/react';

export default function Index({ notes }) {
    const destroy = (note) => {
        if (window.confirm(`Delete "${note.title}"?`)) {
            router.delete(route('notes.destroy', note.id), {
                preserveScroll: true,
            });
        }
    };

    return <NotesGlassIndexView notes={notes} onDestroy={destroy} />;
}

Index.layout = (page) => (
    <AuthenticatedLayout module="notes">{page}</AuthenticatedLayout>
);
