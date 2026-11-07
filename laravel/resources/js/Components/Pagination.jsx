import { Link } from '@inertiajs/react';

/**
 * Renders Laravel's paginator links. Expects the `links` array from a
 * paginated Inertia prop (`notes.links`, `entries.links`, ...).
 *
 * @param {{ links?: Array<{ url: string|null, label: string, active: boolean }> }} props
 */
export default function Pagination({ links = [] }) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <nav className="mt-6 flex flex-wrap gap-1" aria-label="Pagination">
            {links.map((link, index) =>
                link.url === null ? (
                    <span
                        key={index}
                        className="rounded px-3 py-2 text-sm text-gray-400 dark:text-gray-600"
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <Link
                        key={index}
                        href={link.url}
                        aria-current={link.active ? 'page' : undefined}
                        className={`rounded px-3 py-2 text-sm transition ${
                            link.active
                                ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ),
            )}
        </nav>
    );
}
