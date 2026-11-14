import GlassCard from '@/Components/Glass/GlassCard';
import Sparkline from '@/Components/Glass/Sparkline';
import StatPill from '@/Components/Glass/StatPill';
import { Link } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';
import {
    budgetLayout,
    buildBalanceTrend,
    DueList,
    summarizeInOut,
} from './shared';

export default function Overview({ accounts, transactions, totalCents, due }) {
    const trend = buildBalanceTrend(transactions);
    const { inCents, outCents } = summarizeInOut(transactions);

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard title="Total balance" className="lg:col-span-2">
                <div className="text-3xl font-bold">
                    {formatZar(totalCents)}
                </div>
                <p className="mb-2 mt-1 text-xs text-[var(--muted)]">
                    Across {accounts.length} account
                    {accounts.length === 1 ? '' : 's'}
                </p>
                <Sparkline values={trend} />
                <div className="mt-3 flex gap-2">
                    <StatPill
                        label="Recent in"
                        value={formatZar(inCents)}
                        dotColor="#1D9E75"
                    />
                    <StatPill
                        label="Recent out"
                        value={formatZar(outCents)}
                        dotColor="#D4537E"
                    />
                </div>
            </GlassCard>

            <GlassCard title="Accounts">
                {accounts.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        No accounts yet.{' '}
                        <Link
                            href={route('budget.cards')}
                            className="font-semibold text-[var(--accent)] hover:underline"
                        >
                            Add one
                        </Link>
                        .
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className="flex items-center justify-between"
                            >
                                <span className="text-sm text-[var(--muted)]">
                                    {account.name}
                                </span>
                                <span className="text-sm font-semibold tabular-nums">
                                    {formatZar(account.balance_cents)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard
                title="Due soon"
                className="lg:col-span-3"
                action={
                    <Link
                        href={route('budget.recurring')}
                        className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
                    >
                        Recurring
                    </Link>
                }
            >
                <DueList due={due} />
                <p className="mt-3 text-[10.5px] text-[var(--muted)]">
                    The server sends no notifications. This page checks when it
                    loads, and only while it is open.
                </p>
            </GlassCard>
        </div>
    );
}

Overview.layout = budgetLayout;
