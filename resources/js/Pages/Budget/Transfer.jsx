import GlassCard from '@/Components/Glass/GlassCard';
import { Link } from '@inertiajs/react';
import { budgetLayout, GlassTransferForm } from './shared';

export default function Transfer({ accounts }) {
    return (
        <div className="max-w-xl">
            <GlassCard title="Transfer money">
                {accounts.length < 2 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Two accounts are needed to transfer between them.{' '}
                        <Link
                            href={route('budget.cards')}
                            className="font-semibold text-[var(--accent)] hover:underline"
                        >
                            Add an account
                        </Link>
                        .
                    </p>
                ) : (
                    <GlassTransferForm accounts={accounts} />
                )}
            </GlassCard>
        </div>
    );
}

Transfer.layout = budgetLayout;
