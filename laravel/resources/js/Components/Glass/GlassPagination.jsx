import { Link } from '@inertiajs/react';

/**
 * Glass-styled counterpart to Components/Pagination.jsx, same `links` shape
 * (Laravel paginator links: { url, label, active }).
 */
export default function GlassPagination({ links }) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <div className="mt-3 flex flex-wrap items-center gap-1">
            {links.map((link, index) =>
                link.url ? (
                    <Link
                        key={index}
                        href={link.url}
                        className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold ' +
                            (link.active
                                ? 'bg-[#2B6CFF] text-[#06121A]'
                                : 'text-white/50 hover:text-white')
                        }
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span
                        key={index}
                        className="rounded-full px-3 py-1.5 text-xs text-white/20"
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ),
            )}
        </div>
    );
}
