import GlassCard from '@/Components/Glass/GlassCard';
import { router } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';
import { budgetLayout, GlassAccountForm } from './shared';

export default function Cards({ accounts }) {
    const deleteAccount = (account) => {
        if (
            window.confirm(
                `Delete "${account.name}"? Its transactions go with it.`,
            )
        ) {
            router.delete(route('budget.accounts.destroy', account.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
                {accounts.length === 0 ? (
                    <GlassCard>
                        <p className="text-sm text-[var(--muted)]">
                            No accounts yet — add one on the right.
                        </p>
                    </GlassCard>
                ) : (
                    accounts.map((account) => (
                        <GlassCard key={account.id}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">
                                        {account.name}
                                    </p>
                                    <p className="mt-1 text-xl font-bold tabular-nums">
                                        {formatZar(account.balance_cents)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => deleteAccount(account)}
                                    className="text-xs text-[var(--neg)] hover:underline"
                                >
                                    Delete
                                </button>
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>

            <GlassCard title="New account">
                <GlassAccountForm />
            </GlassCard>
        </div>
    );
}

Cards.layout = budgetLayout;
