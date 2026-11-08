import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import NotesGlassFormView from './GlassFormView';
import NotesGlassIndexView from './GlassIndexView';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ notes }) {
    const [editingId, setEditingId] = useState(null);
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        useForm({ title: '', body: '' });

    const startNew = () => {
        setEditingId(null);
        reset();
        clearErrors();
    };

    const startEdit = (note) => {
        setEditingId(note.id);
        clearErrors();
        setData({ title: note.title ?? '', body: note.body ?? '' });
    };

    const submit = (event) => {
        event.preventDefault();

        const onSuccess = () => startNew();

        if (editingId) {
            put(route('notes.update', editingId), {
                preserveScroll: true,
                onSuccess,
            });
        } else {
            post(route('notes.store'), { preserveScroll: true, onSuccess });
        }
    };

    const destroy = (note) => {
        if (window.confirm(`Delete "${note.title}"?`)) {
            router.delete(route('notes.destroy', note.id), {
                preserveScroll: true,
                onSuccess: () => {
                    if (editingId === note.id) {
                        startNew();
                    }
                },
            });
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
            <div className="min-h-0 flex-1">
                <NotesGlassIndexView
                    notes={notes}
                    editingId={editingId}
                    onEdit={startEdit}
                    onNew={startNew}
                    onDestroy={destroy}
                />
            </div>
            <div className="w-full lg:w-96">
                <NotesGlassFormView
                    id="note-form"
                    isEdit={Boolean(editingId)}
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    onSubmit={submit}
                    onCancel={startNew}
                    className=""
                />
            </div>
        </div>
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="notes">{page}</AuthenticatedLayout>
);
