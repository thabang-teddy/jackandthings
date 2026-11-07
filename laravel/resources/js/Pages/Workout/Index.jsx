import EmptyState from '@/Components/EmptyState';
import PageShell from '@/Components/PageShell';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';

export default function Index({ entries, dueForReminder, lastLoggedAt }) {
    const destroy = (entry) => {
        if (window.confirm(`Delete "${entry.activity}"?`)) {
            router.delete(route('workouts.destroy', entry.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <PageShell
            title="Workout"
            action={
                <Link href={route('workouts.create')}>
                    <PrimaryButton>Log workout</PrimaryButton>
                </Link>
            }
        >
            {dueForReminder && (
                <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                        Nothing logged this hour
                    </p>
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                        {lastLoggedAt
                            ? `Last workout: ${lastLoggedAt}.`
                            : 'No workouts logged yet.'}
                    </p>
                </div>
            )}

            {entries.data.length === 0 ? (
                <EmptyState
                    title="No workouts logged"
                    description="Log what you do through the day to build up a record."
                >
                    <Link href={route('workouts.create')}>
                        <PrimaryButton>Log your first workout</PrimaryButton>
                    </Link>
                </EmptyState>
            ) : (
                <ul className="space-y-3">
                    {entries.data.map((entry) => (
                        <li
                            key={entry.id}
                            className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-medium text-gray-900 dark:text-gray-100">
                                        {entry.activity}
                                    </h2>
                                    {entry.notes && (
                                        <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                                            {entry.notes}
                                        </p>
                                    )}
                                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                        {entry.logged_at}
                                    </p>
                                </div>

                                <div className="flex shrink-0 gap-3 text-sm">
                                    <Link
                                        href={route('workouts.edit', entry.id)}
                                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => destroy(entry)}
                                        className="text-red-600 hover:underline dark:text-red-400"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Pagination links={entries.links} />
        </PageShell>
    );
}

Index.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;
