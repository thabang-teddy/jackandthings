import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ClipboardGlassIndexView from './GlassIndexView';
import { router } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ items }) {
    const [copiedId, setCopiedId] = useState(null);

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

    return (
        <ClipboardGlassIndexView
            items={items}
            copiedId={copiedId}
            onCopy={copy}
            onDestroy={destroy}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="clipboard">{page}</AuthenticatedLayout>
);
