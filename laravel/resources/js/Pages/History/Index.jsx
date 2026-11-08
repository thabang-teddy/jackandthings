import EmptyState from '@/Components/EmptyState';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useTheme } from '@/Lib/ThemeContext';
import HistoryGlassView from './GlassView';
import { router, useForm } from '@inertiajs/react';

export default function Index({ entries, retentionDays }) {
    const { theme } = useTheme();

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

    if (theme === 'glass') {
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

    return (
        <PageShell title="History">
            <div className="mb-6 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm dark:border-sky-700 dark:bg-sky-900/30">
                <p className="text-sky-900 dark:text-sky-100">
                    Entries older than <strong>{retentionDays} days</strong> are
                    deleted automatically by the nightly prune job.
                </p>
                <p className="mt-1 text-sky-800 dark:text-sky-200">
                    That window is a placeholder default, not a confirmed rule —
                    the real auto-delete policy is still an open decision. Until
                    the browser add-on exists, entries are added here by hand.
                </p>
            </div>

            <form
                onSubmit={submit}
                className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <InputLabel htmlFor="url" value="URL" />
                        <TextInput
                            id="url"
                            type="url"
                            className="mt-1 block w-full"
                            value={data.url}
                            onChange={(e) => setData('url', e.target.value)}
                            placeholder="https://example.com/page"
                            required
                        />
                        <InputError className="mt-2" message={errors.url} />
                    </div>
                    <div>
                        <InputLabel htmlFor="title" value="Title (optional)" />
                        <TextInput
                            id="title"
                            className="mt-1 block w-full"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                        />
                        <InputError className="mt-2" message={errors.title} />
                    </div>
                </div>
                <PrimaryButton disabled={processing}>Add entry</PrimaryButton>
            </form>

            {entries.data.length === 0 ? (
                <EmptyState
                    title="No history entries"
                    description="Add one above, or wait for the browser add-on to report visits."
                />
            ) : (
                <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-5 py-3">Page</th>
                                <th className="px-5 py-3">Visited</th>
                                <th className="px-5 py-3">Source</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {entries.data.map((entry) => (
                                <tr key={entry.id}>
                                    <td className="max-w-md px-5 py-3">
                                        <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
                                            {entry.title || entry.url}
                                        </span>
                                        <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                                            {entry.url}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-600 dark:text-gray-300">
                                        {entry.visited_at}
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                                        {entry.source ?? '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => destroy(entry)}
                                            className="text-red-600 hover:underline dark:text-red-400"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={entries.links} />
        </PageShell>
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="history">{page}</AuthenticatedLayout>
);
