import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { getSubmenuForSecondaryPage } from '@/Lib/glassNav';
import NotesGlassFormView from './GlassFormView';
import { useForm } from '@inertiajs/react';

export default function Form({ note }) {
    const isEdit = Boolean(note);

    const { data, setData, post, put, processing, errors } = useForm({
        title: note?.title ?? '',
        body: note?.body ?? '',
    });

    const submit = (event) => {
        event.preventDefault();

        if (isEdit) {
            put(route('notes.update', note.id));
        } else {
            post(route('notes.store'));
        }
    };

    return (
        <NotesGlassFormView
            isEdit={isEdit}
            data={data}
            setData={setData}
            errors={errors}
            processing={processing}
            onSubmit={submit}
        />
    );
}

Form.layout = (page) => (
    <AuthenticatedLayout
        module="notes"
        submenu={getSubmenuForSecondaryPage('notes', 'notes.index')}
    >
        {page}
    </AuthenticatedLayout>
);
