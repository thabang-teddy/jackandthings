import { Link } from '@inertiajs/react';

function scrollToAnchor(target) {
    const el = document.getElementById(target);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SubmenuPills({ items, activeAnchor }) {
    return (
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {items.map((item) => {
                if (item.type === 'disabled') {
                    return (
                        <span
                            key={item.label}
                            className="cursor-not-allowed rounded-full px-3.5 py-2 text-xs font-semibold text-white/25"
                            title="Not available yet"
                        >
                            {item.label}
                        </span>
                    );
                }

                const isActive =
                    item.type === 'anchor' && item.target === activeAnchor;
                const classes =
                    'rounded-full px-3.5 py-2 text-xs font-semibold transition ' +
                    (isActive
                        ? 'bg-[#2B6CFF] text-[#06121A]'
                        : 'text-white/55 hover:text-white');

                if (item.type === 'link') {
                    return (
                        <Link
                            key={item.label}
                            href={route(item.target)}
                            className={classes}
                        >
                            {item.label}
                        </Link>
                    );
                }

                return (
                    <button
                        key={item.label}
                        type="button"
                        onClick={() => scrollToAnchor(item.target)}
                        className={classes}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
