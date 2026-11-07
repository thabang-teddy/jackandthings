import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, useForm } from '@inertiajs/react';

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
        <PageShell title={isEdit ? 'Edit note' : 'New note'}>
            <form
                onSubmit={submit}
                className="space-y-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
            >
                <div>
                    <InputLabel htmlFor="title" value="Title" />
                    <TextInput
                        id="title"
                        className="mt-1 block w-full"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        isFocused
                        required
                    />
                    <InputError className="mt-2" message={errors.title} />
                </div>

                <div>
                    <InputLabel htmlFor="body" value="Body" />
                    <textarea
                        id="body"
                        rows={10}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                    />
                    <InputError className="mt-2" message={errors.body} />
                </div>

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>
                        {isEdit ? 'Save changes' : 'Create note'}
                    </PrimaryButton>
                    <Link
                        href={route('notes.index')}
                        className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </PageShell>
    );
}

Form.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;
