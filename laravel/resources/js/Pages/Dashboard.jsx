import PageShell from '@/Components/PageShell';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Link } from '@inertiajs/react';

const modules = [
    {
        label: 'Pomodoro',
        route: 'pomodoro.index',
        description: 'Run a focus timer from a saved preset.',
    },
    {
        label: 'Notes',
        route: 'notes.index',
        description: 'Write and keep notes.',
    },
    {
        label: 'Budget',
        route: 'budget.index',
        description: 'Accounts, transactions and transfers in ZAR.',
    },
    {
        label: 'Workout',
        route: 'workouts.index',
        description: 'Log what you do through the day.',
    },
    {
        label: 'Clipboard',
        route: 'clipboard.index',
        description: 'Save snippets to pick up elsewhere.',
    },
    {
        label: 'History',
        route: 'history.index',
        description: 'Browsing history, pruned automatically.',
    },
];

export default function Dashboard() {
    return (
        <PageShell title="Dashboard">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                    <Link
                        key={module.route}
                        href={route(module.route)}
                        className="rounded-lg bg-white p-6 shadow-sm transition hover:shadow-md dark:bg-gray-800"
                    >
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                            {module.label}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {module.description}
                        </p>
                    </Link>
                ))}
            </div>
        </PageShell>
    );
}

Dashboard.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;
