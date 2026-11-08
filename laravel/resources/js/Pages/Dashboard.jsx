import GlassCard from '@/Components/Glass/GlassCard';
import {
    BarsIcon,
    ClockIcon,
    CopyIcon,
    DocumentIcon,
    HeartIcon,
    HistoryIcon,
    HomeIcon,
} from '@/Components/Glass/icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link } from '@inertiajs/react';

const modules = [
    {
        label: 'Pomodoro',
        route: 'pomodoro.index',
        description: 'Run a focus timer from a saved preset.',
        icon: ClockIcon,
        color: '#2B6CFF',
    },
    {
        label: 'Notes',
        route: 'notes.index',
        description: 'Write and keep notes.',
        icon: DocumentIcon,
        color: '#8B5CF6',
    },
    {
        label: 'Budget',
        route: 'budget.index',
        description: 'Accounts, transactions and transfers in ZAR.',
        icon: BarsIcon,
        color: '#1D9E75',
    },
    {
        label: 'Workout',
        route: 'workouts.index',
        description: 'Log what you do through the day.',
        icon: HeartIcon,
        color: '#D4537E',
    },
    {
        label: 'Clipboard',
        route: 'clipboard.index',
        description: 'Save snippets to pick up elsewhere.',
        icon: CopyIcon,
        color: '#BA7517',
    },
    {
        label: 'History',
        route: 'history.index',
        description: 'Browsing history, pruned automatically.',
        icon: HistoryIcon,
        color: '#5F6B5F',
    },
];

export default function Dashboard() {
    return (
        <div className="flex flex-col gap-4">
            <Link
                href={route('home')}
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--accent)]"
            >
                <HomeIcon size={15} />
                Home
            </Link>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => {
                    const IconComponent = module.icon;
                    return (
                        <Link key={module.route} href={route(module.route)}>
                            <GlassCard className="h-full transition hover:border-[var(--accent)]">
                                <div
                                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-full"
                                    style={{
                                        backgroundColor: `${module.color}33`,
                                        color: module.color,
                                    }}
                                >
                                    <IconComponent size={17} />
                                </div>
                                <p className="font-semibold text-[var(--ink)]">
                                    {module.label}
                                </p>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                    {module.description}
                                </p>
                            </GlassCard>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

Dashboard.layout = (page) => (
    <AuthenticatedLayout title="Dashboard">{page}</AuthenticatedLayout>
);
