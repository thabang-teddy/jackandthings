import EmptyState from '@/Components/EmptyState';
import PageShell from '@/Components/PageShell';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link, router } from '@inertiajs/react';

export default function Index({ notes }) {
    const destroy = (note) => {
        if (window.confirm(`Delete "${note.title}"?`)) {
            router.delete(route('notes.destroy', note.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <PageShell
            title="Notes"
            action={
                <Link href={route('notes.create')}>
                    <PrimaryButton>New note</PrimaryButton>
                </Link>
            }
        >
            {notes.data.length === 0 ? (
                <EmptyState
                    title="No notes yet"
                    description="Anything you jot down here stays private to your account."
                >
                    <Link href={route('notes.create')}>
                        <PrimaryButton>Write your first note</PrimaryButton>
                    </Link>
                </EmptyState>
            ) : (
                <ul className="space-y-3">
                    {notes.data.map((note) => (
                        <li
                            key={note.id}
                            className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="truncate font-medium text-gray-900 dark:text-gray-100">
                                        {note.title}
                                    </h2>
                                    {note.body && (
                                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                                            {note.body}
                                        </p>
                                    )}
                                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                        Updated {note.updated_at}
                                    </p>
                                </div>

                                <div className="flex shrink-0 gap-3 text-sm">
                                    <Link
                                        href={route('notes.edit', note.id)}
                                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => destroy(note)}
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

            <Pagination links={notes.links} />
        </PageShell>
    );
}

Index.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;
