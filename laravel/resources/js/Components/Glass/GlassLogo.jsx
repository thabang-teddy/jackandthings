import { useId } from 'react';

/**
 * The Jack & Things mark: a "J" beside three fading bars — the name's two
 * halves, and an echo of the list-and-card surfaces the app is made of.
 *
 * Kept in sync by hand with `public/logo.svg` (the file the favicon, the
 * extension icons and the Android launcher icon are all rendered from).
 * The gradient id is per-instance so several marks can share one page.
 */
export default function GlassLogo({ size = 28, className = '' }) {
    const gradientId = useId();

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            role="img"
            aria-label="Jack & Things"
            className={className}
        >
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="36"
                    y1="14"
                    x2="36"
                    y2="50"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#2B6CFF" />
                    <stop offset="1" stopColor="#17D9D4" />
                </linearGradient>
            </defs>
            <g transform="translate(2 0)">
                <rect
                    x="10"
                    y="14"
                    width="22"
                    height="7"
                    rx="3.5"
                    fill="#2B6CFF"
                    opacity="0.9"
                />
                <rect
                    x="10"
                    y="25"
                    width="16"
                    height="7"
                    rx="3.5"
                    fill="#2B6CFF"
                    opacity="0.6"
                />
                <rect
                    x="10"
                    y="36"
                    width="11"
                    height="7"
                    rx="3.5"
                    fill="#2B6CFF"
                    opacity="0.38"
                />
                <path
                    d="M46 14 V33 Q46 46 33 46"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="8"
                    strokeLinecap="round"
                />
            </g>
        </svg>
    );
}
