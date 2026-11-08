import EmptyState from '@/Components/EmptyState';
import PageShell from '@/Components/PageShell';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useTheme } from '@/Lib/ThemeContext';
import ClipboardGlassIndexView from './GlassIndexView';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ items }) {
    const [copiedId, setCopiedId] = useState(null);
    const { theme } = useTheme();

    const copy = async (item) => {
        try {
            await navigator.clipboard.writeText(item.content);
            setCopiedId(item.id);
            window.setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // Clipboard access can be refused (insecure origin, denied permission);
            // the text stays visible on the page so it can be copied by hand.
            setCopiedId(null);
        }
    };

    const destroy = (item) => {
        if (window.confirm('Delete this snippet?')) {
            router.delete(route('clipboard.destroy', item.id), {
                preserveScroll: true,
            });
        }
    };

    if (theme === 'glass') {
        return (
            <ClipboardGlassIndexView
                items={items}
                copiedId={copiedId}
                onCopy={copy}
                onDestroy={destroy}
            />
        );
    }

    return (
        <PageShell
            title="Clipboard"
            action={
                <Link href={route('clipboard.create')}>
                    <PrimaryButton>New snippet</PrimaryButton>
                </Link>
            }
        >
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Snippets saved here are available to this account. Syncing with
                the Android app and browser add-ons arrives when those clients
                are built.
            </p>

            {items.data.length === 0 ? (
                <EmptyState
                    title="Nothing saved yet"
                    description="Save text here to pick it up from another device later."
                >
                    <Link href={route('clipboard.create')}>
                        <PrimaryButton>Save a snippet</PrimaryButton>
                    </Link>
                </EmptyState>
            ) : (
                <ul className="space-y-3">
                    {items.data.map((item) => (
                        <li
                            key={item.id}
                            className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    {item.title && (
                                        <h2 className="truncate font-medium text-gray-900 dark:text-gray-100">
                                            {item.title}
                                        </h2>
                                    )}
                                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-gray-600 dark:text-gray-300">
                                        {item.content}
                                    </pre>
                                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                        {item.created_at}
                                        {item.source_device
                                            ? ` · from ${item.source_device}`
                                            : ''}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => copy(item)}
                                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        {copiedId === item.id
                                            ? 'Copied'
                                            : 'Copy'}
                                    </button>
                                    <Link
                                        href={route('clipboard.edit', item.id)}
                                        className="text-gray-600 hover:underline dark:text-gray-300"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => destroy(item)}
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

            <Pagination links={items.links} />
        </PageShell>
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="clipboard">{page}</AuthenticatedLayout>
);
