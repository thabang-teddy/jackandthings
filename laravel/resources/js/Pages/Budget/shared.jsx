import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { ArrowDownIcon, ArrowUpIcon, SwapIcon } from '@/Components/Glass/icons';
import { useForm } from '@inertiajs/react';

export const INCOME_TYPES = new Set(['deposit', 'transfer_in']);

export function buildBalanceTrend(transactions) {
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

export function summarizeInOut(transactions) {
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

export function txIcon(type) {
    if (type === 'transfer_in' || type === 'transfer_out') {
        return { icon: <SwapIcon size={14} />, color: '#8B5CF6' };
    }
    if (type === 'deposit') {
        return { icon: <ArrowDownIcon size={14} />, color: '#1D9E75' };
    }
    return { icon: <ArrowUpIcon size={14} />, color: '#D4537E' };
}

/** Shared layout for every Budget page — the module rail plus budget submenu. */
export function budgetLayout(page) {
    return <AuthenticatedLayout module="budget">{page}</AuthenticatedLayout>;
}

export function GlassAccountForm() {
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

export function GlassTransactionForm({ accounts }) {
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

export function GlassTransferForm({ accounts }) {
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
