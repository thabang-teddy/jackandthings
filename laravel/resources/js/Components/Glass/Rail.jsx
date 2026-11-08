import { Link } from '@inertiajs/react';
import { MODULES } from '@/Lib/glassNav';
import {
    BarsIcon,
    ClockIcon,
    CopyIcon,
    DocumentIcon,
    HeartIcon,
    HistoryIcon,
} from '@/Components/Glass/icons';

const ICONS = {
    clock: ClockIcon,
    document: DocumentIcon,
    bars: BarsIcon,
    heart: HeartIcon,
    copy: CopyIcon,
    history: HistoryIcon,
};

export default function Rail({ active }) {
    return (
        <div className="flex w-[62px] shrink-0 flex-col items-center gap-[14px] rounded-[28px] border border-white/10 bg-white/5 py-[18px]">
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
                                ? 'bg-[#2B6CFF] text-[#06121A]'
                                : 'text-white/40 hover:text-white/70')
                        }
                    >
                        <IconComponent size={17} />
                    </Link>
                );
            })}
        </div>
    );
}
