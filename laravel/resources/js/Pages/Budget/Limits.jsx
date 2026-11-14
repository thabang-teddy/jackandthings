import GlassCard from '@/Components/Glass/GlassCard';
import { GlassInput } from '@/Components/Glass/GlassFormControls';
import { router } from '@inertiajs/react';
import {
    budgetLayout,
    formatPeriodLabel,
    GlassLimitForm,
    LimitMeter,
} from './shared';

export default function Limits({ period, categories, limits }) {
    const changePeriod = (event) => {
        router.get(
            route('budget.limits'),
            { period: event.target.value },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const remove = (limit) => {
        if (window.confirm(`Remove the ${limit.category} cap?`)) {
            router.delete(route('budget.limits.destroy', limit.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard
                title={`Caps for ${formatPeriodLabel(period)}`}
                className="min-h-0 overflow-y-auto lg:col-span-2"
                action={
                    <GlassInput
                        type="month"
                        value={period}
                        onChange={changePeriod}
                        aria-label="Limit month"
                        className="w-36"
                    />
                }
            >
                {limits.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        No caps for this month. A cap is per category, per
                        month, and can be set or changed at any time.
                    </p>
                ) : (
                    <>
                        {limits.map((limit) => (
                            <div key={limit.id} className="group relative">
                                <LimitMeter limit={limit} />
                                <button
                                    type="button"
                                    onClick={() => remove(limit)}
                                    className="absolute right-0 top-2.5 text-[10.5px] text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--neg)] focus:opacity-100 group-hover:opacity-100"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <p className="mt-3 text-[11px] text-[var(--muted)]">
                            Spent totals come from withdrawals filed under each
                            category. Closing in on a cap turns the bar amber at
                            80%.
                        </p>
                    </>
                )}
            </GlassCard>

            <GlassCard title="Set a cap">
                {categories.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Add an expense category first.
                    </p>
                ) : (
                    <GlassLimitForm
                        key={period}
                        categories={categories}
                        period={period}
                    />
                )}
            </GlassCard>
        </div>
    );
}

Limits.layout = budgetLayout;
