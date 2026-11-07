import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, useForm } from '@inertiajs/react';

export default function Form({ item }) {
    const isEdit = Boolean(item);

    const { data, setData, post, put, processing, errors } = useForm({
        title: item?.title ?? '',
        content: item?.content ?? '',
    });

    const submit = (event) => {
        event.preventDefault();

        if (isEdit) {
            put(route('clipboard.update', item.id));
        } else {
            post(route('clipboard.store'));
        }
    };

    return (
        <PageShell title={isEdit ? 'Edit snippet' : 'New snippet'}>
            <form
                onSubmit={submit}
                className="space-y-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
            >
                <div>
                    <InputLabel htmlFor="title" value="Title (optional)" />
                    <TextInput
                        id="title"
                        className="mt-1 block w-full"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        isFocused
                    />
                    <InputError className="mt-2" message={errors.title} />
                </div>

                <div>
                    <InputLabel htmlFor="content" value="Content" />
                    <textarea
                        id="content"
                        rows={8}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                        value={data.content}
                        onChange={(e) => setData('content', e.target.value)}
                    />
                    <InputError className="mt-2" message={errors.content} />
                </div>

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>
                        {isEdit ? 'Save changes' : 'Save snippet'}
                    </PrimaryButton>
                    <Link
                        href={route('clipboard.index')}
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
