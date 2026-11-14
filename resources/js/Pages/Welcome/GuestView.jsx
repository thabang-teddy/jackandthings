import { Link } from '@inertiajs/react';
import LiveClock from '@/Components/Glass/LiveClock';
import { PersonIcon } from '@/Components/Glass/icons';

export default function GuestView({ canLogin }) {
    return (
        <div className="relative z-10 flex min-h-screen items-center justify-center">
            {canLogin && (
                <Link
                    href={route('login')}
                    aria-label="Log in"
                    className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink)] transition hover:border-[var(--accent)]"
                >
                    <PersonIcon size={18} />
                </Link>
            )}

            <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                    Jack &amp; Things
                </p>
                <LiveClock className="text-7xl sm:text-8xl lg:text-9xl" />
            </div>
        </div>
    );
}
