import GlassCard from '@/Components/Glass/GlassCard';
import Sparkline from '@/Components/Glass/Sparkline';
import { GlassInput, GlassSelect } from '@/Components/Glass/GlassFormControls';
import { router } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';
import {
    budgetLayout,
    formatPeriodLabel,
    InOutBars,
    LimitMeter,
} from './shared';

export default function Reports({
    period,
    months,
    categories,
    monthly,
    netWorth,
    limits,
}) {
    const changePeriod = (event) => {
        router.get(
            route('budget.reports'),
            { period: event.target.value, months },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const changeMonths = (event) => {
        router.get(
            route('budget.reports'),
            { period, months: event.target.value },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const spending = categories
        .filter((category) => category.kind === 'expense')
        .sort((left, right) => right.spent_cents - left.spent_cents);
    const income = categories
        .filter((category) => category.kind === 'income')
        .sort((left, right) => right.income_cents - left.income_cents);

    const totalSpent = spending.reduce(
        (total, category) => total + category.spent_cents,
        0,
    );
    const totalIncome = income.reduce(
        (total, category) => total + category.income_cents,
        0,
    );
    const largest = spending[0]?.spent_cents ?? 0;

    const netValues = netWorth.map((point) => point.net_cents / 100);
    const latestNet = netValues[netValues.length - 1] ?? 0;
    const firstNet = netValues[0] ?? 0;

    const controls = (
        <div className="flex items-center gap-2">
            <GlassInput
                type="month"
                value={period}
                onChange={changePeriod}
                aria-label="Report month"
                className="w-36"
            />
            <GlassSelect
                value={months}
                onChange={changeMonths}
                aria-label="Months to chart"
                className="w-32"
            >
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
            </GlassSelect>
        </div>
    );

    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard
                title={`Income vs expenses - ${formatPeriodLabel(period)}`}
                className="lg:col-span-2"
                action={controls}
            >
                <InOutBars series={monthly} />
                <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--muted)]">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#1D9E75]" />
                        Income
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#D4537E]" />
                        Expenses
                    </span>
                    <span className="ml-auto tabular-nums">
                        {formatPeriodLabel(period)}: in {formatZar(totalIncome)}
                        , out {formatZar(totalSpent)}
                    </span>
                </div>
                <p className="mt-2 text-[10.5px] text-[var(--muted)]">
                    Transfers between your own accounts are excluded: moving
                    money is neither income nor spending.
                </p>
            </GlassCard>

            <GlassCard title="Net worth">
                <p className="text-2xl font-bold tabular-nums">
                    {formatZar(Math.round(latestNet * 100))}
                </p>
                <p className="mb-2 mt-1 text-[11px] text-[var(--muted)]">
                    {netWorth.length > 1
                        ? `${latestNet >= firstNet ? 'Up' : 'Down'} ${formatZar(Math.round(Math.abs(latestNet - firstNet) * 100))} over ${netWorth.length} months`
                        : 'One month so far'}
                </p>
                <Sparkline values={netValues} />
            </GlassCard>

            <GlassCard
                title="Spending by category"
                className="min-h-0 overflow-y-auto lg:col-span-2"
            >
                {spending.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        No withdrawals filed this month. Pick a category when
                        logging a transaction and it lands here.
                    </p>
                ) : (
                    spending.map((category) => (
                        <div
                            key={category.category_id ?? 'uncategorized'}
                            className="border-b border-[var(--card-border)] py-2.5 last:border-b-0"
                        >
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="truncate font-semibold">
                                    {category.name}
                                </span>
                                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                                    {formatZar(category.spent_cents)}
                                </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--card-border)]">
                                <div
                                    className="h-full rounded-full bg-[#D4537E]"
                                    style={{
                                        width: `${largest === 0 ? 0 : Math.round((category.spent_cents * 100) / largest)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </GlassCard>

            <div className="flex flex-col gap-4">
                <GlassCard title="Caps" className="min-h-0 overflow-y-auto">
                    {limits.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            No caps set for this month.
                        </p>
                    ) : (
                        limits.map((limit) => (
                            <LimitMeter key={limit.id} limit={limit} />
                        ))
                    )}
                </GlassCard>

                <GlassCard title="Export">
                    <p className="text-sm text-[var(--muted)]">
                        Every transaction as CSV, which opens in Excel and
                        Sheets.
                    </p>
                    <a
                        href={route('budget.export')}
                        className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
                    >
                        Download CSV
                    </a>
                </GlassCard>
            </div>
        </div>
    );
}

Reports.layout = budgetLayout;
