import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassInput,
    GlassLabel,
} from '@/Components/Glass/GlassFormControls';
import { router, useForm } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';
import { budgetLayout, GlassGoalForm } from './shared';

function GoalRow({ goal }) {
    const { data, setData, put, processing, errors } = useForm({
        saved: (goal.saved_cents / 100).toString(),
    });

    const save = (event) => {
        event.preventDefault();
        put(route('budget.goals.update', goal.id), { preserveScroll: true });
    };

    const remove = () => {
        if (window.confirm(`Delete the "${goal.name}" goal?`)) {
            router.delete(route('budget.goals.destroy', goal.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="border-b border-[var(--card-border)] py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold">
                        {goal.name}
                        {goal.complete && (
                            <span className="ml-2 rounded-full bg-[var(--pos)] px-2 py-0.5 text-[10px] font-bold text-white">
                                Reached
                            </span>
                        )}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                        {goal.account ? `${goal.account} - ` : ''}
                        {goal.target_date
                            ? `by ${goal.target_date}`
                            : 'no target date'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={remove}
                    className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                >
                    Delete
                </button>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--card-border)]">
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${goal.percent}%`,
                        backgroundColor: goal.complete
                            ? 'var(--pos)'
                            : '#2B6CFF',
                    }}
                />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--muted)]">
                <span className="tabular-nums">
                    {formatZar(goal.saved_cents)} of{' '}
                    {formatZar(goal.target_cents)}
                </span>
                <span className="tabular-nums">
                    {goal.complete
                        ? 'Complete'
                        : `${formatZar(goal.remaining_cents)} to go`}
                </span>
            </div>

            <form onSubmit={save} className="mt-2 flex items-end gap-2">
                <div className="w-40">
                    <GlassLabel htmlFor={`glass_goal_saved_${goal.id}`}>
                        Saved so far (ZAR)
                    </GlassLabel>
                    <GlassInput
                        id={`glass_goal_saved_${goal.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={data.saved}
                        onChange={(e) => setData('saved', e.target.value)}
                    />
                </div>
                <GlassButton type="submit" disabled={processing}>
                    Save
                </GlassButton>
            </form>
            <p className="mt-1 text-[10.5px] text-[var(--neg)]">
                {errors.saved}
            </p>
        </div>
    );
}

export default function Goals({ accounts, goals }) {
    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard
                title="Goals"
                className="min-h-0 overflow-y-auto lg:col-span-2"
            >
                {goals.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        A goal is a savings target you update yourself. It does
                        not move money between accounts.
                    </p>
                ) : (
                    goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)
                )}
            </GlassCard>

            <GlassCard title="New goal">
                <GlassGoalForm accounts={accounts} />
            </GlassCard>
        </div>
    );
}

Goals.layout = budgetLayout;
