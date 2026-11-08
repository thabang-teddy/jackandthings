/**
 * Small inline-SVG icon set shared across the glass theme (rail, topbar,
 * TxRow). Each icon is a plain function component — no dangerouslySetInnerHTML,
 * no external icon font dependency.
 */

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

export function ClockIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}

export function DocumentIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
    );
}

export function BarsIcon({ size = 16, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <rect x="4" y="12" width="3" height="8" />
            <rect x="10" y="7" width="3" height="13" />
            <rect x="16" y="3" width="3" height="17" />
        </svg>
    );
}

export function HeartIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5c2 0 3.5 1.2 4.5 2.7C12 6.2 13.5 5 15.5 5 19 5 21.5 8.5 19.5 12.5 17 16.65 12 21 12 21z" />
        </svg>
    );
}

export function CopyIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <rect x="3" y="3" width="13" height="16" rx="2" />
            <rect x="8" y="8" width="13" height="16" rx="2" />
        </svg>
    );
}

export function HistoryIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M4 12a8 8 0 1 1 2.3 5.6" />
            <path d="M4 16v-4h4" />
        </svg>
    );
}

export function SearchIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
        </svg>
    );
}

export function BellIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
    );
}

export function ArrowDownIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
    );
}

export function ArrowUpIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
    );
}

export function SwapIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M7 10h13l-4-4M17 14H4l4 4" />
        </svg>
    );
}

export function PersonIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
    );
}

export function PlusIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

export function GridIcon({ size = 16, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
    );
}

export function CheckIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} className={className} {...base}>
            <path d="M5 13l4 4L19 7" />
        </svg>
    );
}
