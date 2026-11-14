import { Link } from '@inertiajs/react';
import GlassLogo from '@/Components/Glass/GlassLogo';
import { MODULES } from '@/Lib/glassNav';
import {
    GridIcon,
    BarsIcon,
    ClockIcon,
    DocumentIcon,
    HeartIcon,
    HistoryIcon,
    ListIcon,
    HomeIcon,
} from '@/Components/Glass/icons';

const ICONS = {
    home: HomeIcon,
    grid: GridIcon,
    clock: ClockIcon,
    document: DocumentIcon,
    bars: BarsIcon,
    heart: HeartIcon,
    list: ListIcon,
    history: HistoryIcon,
};

export default function Rail({ active }) {
    return (
        <div className="flex w-[62px] shrink-0 flex-col items-center gap-[14px] rounded-[28px] border border-[var(--rail-border)] bg-[var(--rail-bg)] py-[18px]">
            <Link
                href={route('home')}
                title="Jack & Things"
                className="flex h-[34px] w-[34px] items-center justify-center transition hover:opacity-80"
            >
                <GlassLogo size={26} />
            </Link>
            <div
                aria-hidden="true"
                className="h-px w-[26px] shrink-0 bg-[var(--rail-border)]"
            />

            {MODULES.map((item) => {
                const IconComponent = ICONS[item.icon];
                const isActive = item.key === active;

                return (
                    <Link
                        key={item.key}
                        href={route(item.route)}
                        title={item.label}
                        className={
                            'flex h-[34px] w-[34px] items-center justify-center rounded-full transition ' +
                            (isActive
                                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                : 'text-[var(--rail-icon)] hover:text-[var(--ink)]')
                        }
                    >
                        <IconComponent size={17} />
                    </Link>
                );
            })}
        </div>
    );
}
