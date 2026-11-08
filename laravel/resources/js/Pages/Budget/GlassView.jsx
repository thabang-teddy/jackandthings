import GlassCard from '@/Components/Glass/GlassCard';
import Sparkline from '@/Components/Glass/Sparkline';
import StatPill from '@/Components/Glass/StatPill';
import TxRow from '@/Components/Glass/TxRow';
import { ArrowDownIcon, ArrowUpIcon, SwapIcon } from '@/Components/Glass/icons';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { formatZar } from '@/Lib/formatZar';
import { TYPE_LABELS } from '@/Lib/budgetTypeLabels';
import { useForm } from '@inertiajs/react';

const INCOME_TYPES = new Set(['deposit', 'transfer_in']);

function buildBalanceTrend(transactions) {
    const chronological = [...transactions].reverse();
    let running = 0;

    return chronological.map((transaction) => {
        const signed = INCOME_TYPES.has(transaction.type)
            ? transaction.amount_cents
            : -transaction.amount_cents;
        running += signed;
        return running / 100;
    });
}

function summarizeInOut(transactions) {
    return transactions.reduce(
        (totals, transaction) => {
            if (INCOME_TYPES.has(transaction.type)) {
                totals.inCents += transaction.amount_cents;
            } else {
                totals.outCents += transaction.amount_cents;
            }
            return totals;
        },
        { inCents: 0, outCents: 0 },
    );
}

function txIcon(type) {
    if (type === 'transfer_in' || type === 'transfer_out') {
        return { icon: <SwapIcon size={14} />, color: '#8B5CF6' };
    }
    if (type === 'deposit') {
        return { icon: <ArrowDownIcon size={14} />, color: '#1D9E75' };
    }
    return { icon: <ArrowUpIcon size={14} />, color: '#D4537E' };
}

function GlassAccountForm() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.accounts.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_account_name">
                    Account name
                </GlassLabel>
                <GlassInput
                    id="glass_account_name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Cash, Savings…"
                    required
                />
                <GlassError message={errors.name} />
            </div>
            <GlassButton type="submit" disabled={processing}>
                Add account
            </GlassButton>
        </form>
    );
}

function GlassTransactionForm({ accounts }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        account_id: accounts[0]?.id ?? '',
        type: 'deposit',
        amount: '',
        description: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.transactions.store'), {
            preserveScroll: true,
            onSuccess: () => reset('amount', 'description'),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_tx_account">Account</GlassLabel>
                <GlassSelect
                    id="glass_tx_account"
                    value={data.account_id}
                    onChange={(e) => setData('account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.account_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_tx_type">Type</GlassLabel>
                <GlassSelect
                    id="glass_tx_type"
                    value={data.type}
                    onChange={(e) => setData('type', e.target.value)}
                >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                </GlassSelect>
                <GlassError message={errors.type} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_tx_amount">Amount (ZAR)</GlassLabel>
                <GlassInput
                    id="glass_tx_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={data.amount}
                    onChange={(e) => setData('amount', e.target.value)}
                    required
                />
                <GlassError message={errors.amount} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_tx_description">
                    Description (optional)
                </GlassLabel>
                <GlassInput
                    id="glass_tx_description"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                />
                <GlassError message={errors.description} />
            </div>
            <GlassButton type="submit" disabled={processing}>
                Post transaction
            </GlassButton>
        </form>
    );
}

function GlassTransferForm({ accounts }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        from_account_id: accounts[0]?.id ?? '',
        to_account_id: accounts[1]?.id ?? '',
        amount: '',
        description: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.transfers.store'), {
            preserveScroll: true,
            onSuccess: () => reset('amount', 'description'),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_from_account">From</GlassLabel>
                <GlassSelect
                    id="glass_from_account"
                    value={data.from_account_id}
                    onChange={(e) => setData('from_account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.from_account_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_to_account">To</GlassLabel>
                <GlassSelect
                    id="glass_to_account"
                    value={data.to_account_id}
                    onChange={(e) => setData('to_account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.to_account_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_transfer_amount">
                    Amount (ZAR)
                </GlassLabel>
                <GlassInput
                    id="glass_transfer_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={data.amount}
                    onChange={(e) => setData('amount', e.target.value)}
                    required
                />
                <GlassError message={errors.amount} />
            </div>
            <GlassButton type="submit" disabled={processing}>
                Transfer
            </GlassButton>
        </form>
    );
}

export default function BudgetGlassView({
    accounts,
    transactions,
    totalCents,
    onDeleteAccount,
    onDeleteTransaction,
}) {
    const trend = buildBalanceTrend(transactions);
    const { inCents, outCents } = summarizeInOut(transactions);

    return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <div id="overview" className="flex flex-col gap-4">
                <GlassCard title="Total balance">
                    <div className="text-3xl font-bold">
                        {formatZar(totalCents)}
                    </div>
                    <p className="mb-2 mt-1 text-xs text-white/40">
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

                <GlassCard title="New account">
                    <GlassAccountForm />
                </GlassCard>
            </div>

            <div className="flex flex-col gap-4">
                {accounts.length === 0 ? (
                    <GlassCard>
                        <p className="text-sm text-white/40">
                            No accounts yet — add one to get started.
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
                                    onClick={() => onDeleteAccount(account)}
                                    className="text-xs text-rose-400 hover:underline"
                                >
                                    Delete
                                </button>
                            </div>
                        </GlassCard>
                    ))
                )}

                <GlassCard id="transfer" title="Transfer money">
                    {accounts.length < 2 ? (
                        <p className="text-sm text-white/40">
                            Two accounts are needed to transfer between them.
                        </p>
                    ) : (
                        <GlassTransferForm accounts={accounts} />
                    )}
                </GlassCard>
            </div>

            <div className="flex min-h-0 flex-col gap-4">
                <GlassCard title="Add transaction">
                    {accounts.length === 0 ? (
                        <p className="text-sm text-white/40">
                            Add an account first.
                        </p>
                    ) : (
                        <GlassTransactionForm accounts={accounts} />
                    )}
                </GlassCard>

                <GlassCard
                    id="transactions"
                    title="Recent activity"
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    {transactions.length === 0 ? (
                        <p className="text-sm text-white/40">
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
                                    subtitle={
                                        transaction.related_account
                                            ? `${transaction.account} ↔ ${transaction.related_account}`
                                            : transaction.account
                                    }
                                    trailing={formatZar(
                                        transaction.amount_cents,
                                    )}
                                    trailingTone={
                                        INCOME_TYPES.has(transaction.type)
                                            ? 'pos'
                                            : 'neg'
                                    }
                                    action={
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onDeleteTransaction(transaction)
                                            }
                                            className="ml-2 shrink-0 text-xs text-white/30 hover:text-rose-400"
                                        >
                                            Remove
                                        </button>
                                    }
                                />
                            );
                        })
                    )}
                </GlassCard>
            </div>
        </div>
    );
}
