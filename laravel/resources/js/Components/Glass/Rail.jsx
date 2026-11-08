import { Link } from '@inertiajs/react';
import { MODULES } from '@/Lib/glassNav';
import {
    GridIcon,
    BarsIcon,
    ClockIcon,
    DocumentIcon,
    HeartIcon,
    HistoryIcon,
    ListIcon,
} from '@/Components/Glass/icons';

const ICONS = {
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
