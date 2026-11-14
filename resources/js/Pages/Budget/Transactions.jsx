import GlassCard from '@/Components/Glass/GlassCard';
import TxRow from '@/Components/Glass/TxRow';
import { Link, router } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';
import { TYPE_LABELS } from '@/Lib/budgetTypeLabels';
import {
    budgetLayout,
    GlassTransactionForm,
    INCOME_TYPES,
    ReceiptControl,
    txIcon,
} from './shared';

function describeTransaction(transaction) {
    if (transaction.related_account) {
        return `${transaction.account} to ${transaction.related_account}`;
    }

    const parts = [transaction.account];

    if (transaction.category) {
        parts.push(transaction.category);
    }
    if (transaction.merchant) {
        parts.push(transaction.merchant);
    }
    if (transaction.occurred_on) {
        parts.push(transaction.occurred_on);
    }

    return parts.join(' - ');
}

export default function Transactions({ accounts, categories, transactions }) {
    const deleteTransaction = (transaction) => {
        if (window.confirm('Remove this transaction?')) {
            router.delete(
                route('budget.transactions.destroy', transaction.id),
                {
                    preserveScroll: true,
                },
            );
        }
    };

    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard title="Add transaction">
                {accounts.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        <Link
                            href={route('budget.cards')}
                            className="font-semibold text-[var(--accent)] hover:underline"
                        >
                            Add an account
                        </Link>{' '}
                        first.
                    </p>
                ) : (
                    <GlassTransactionForm
                        accounts={accounts}
                        categories={categories}
                    />
                )}
            </GlassCard>

            <GlassCard
                title="Recent activity"
                className="min-h-0 overflow-y-auto lg:col-span-2"
            >
                {transactions.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Deposits, withdrawals and transfers show up here.
                    </p>
                ) : (
                    transactions.map((transaction) => {
                        const { icon, color } = txIcon(transaction.type);
                        return (
                            <TxRow
                                key={transaction.id}
                                icon={icon}
                                iconColor={color}
                                title={
                                    TYPE_LABELS[transaction.type] ??
                                    transaction.type
                                }
                                subtitle={describeTransaction(transaction)}
                                trailing={formatZar(transaction.amount_cents)}
                                trailingTone={
                                    INCOME_TYPES.has(transaction.type)
                                        ? 'pos'
                                        : 'neg'
                                }
                                action={
                                    <div className="flex shrink-0 items-center">
                                        {transaction.type !== 'transfer_in' &&
                                            transaction.type !==
                                                'transfer_out' && (
                                                <ReceiptControl
                                                    transaction={transaction}
                                                />
                                            )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                deleteTransaction(transaction)
                                            }
                                            className="ml-2 shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                }
                            />
                        );
                    })
                )}
            </GlassCard>
        </div>
    );
}

Transactions.layout = budgetLayout;
