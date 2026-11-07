import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, useForm } from '@inertiajs/react';

export default function Form({ entry }) {
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
        <PageShell title={isEdit ? 'Edit workout' : 'Log workout'}>
            <form
                onSubmit={submit}
                className="space-y-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
            >
                <div>
                    <InputLabel htmlFor="activity" value="Activity" />
                    <TextInput
                        id="activity"
                        className="mt-1 block w-full"
                        value={data.activity}
                        onChange={(e) => setData('activity', e.target.value)}
                        placeholder="Push-ups, 5km run, gym session…"
                        isFocused
                        required
                    />
                    <InputError className="mt-2" message={errors.activity} />
                </div>

                <div>
                    <InputLabel
                        htmlFor="logged_at"
                        value="When (defaults to now)"
                    />
                    <TextInput
                        id="logged_at"
                        type="datetime-local"
                        className="mt-1 block w-full"
                        value={data.logged_at}
                        onChange={(e) => setData('logged_at', e.target.value)}
                    />
                    <InputError className="mt-2" message={errors.logged_at} />
                </div>

                <div>
                    <InputLabel htmlFor="notes" value="Notes (optional)" />
                    <textarea
                        id="notes"
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                    />
                    <InputError className="mt-2" message={errors.notes} />
                </div>

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>
                        {isEdit ? 'Save changes' : 'Log it'}
                    </PrimaryButton>
                    <Link
                        href={route('workouts.index')}
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
