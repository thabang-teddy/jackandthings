import EmptyState from '@/Components/EmptyState';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatZar } from '@/Lib/formatZar';
import { getSubmenu } from '@/Lib/glassNav';
import { useTheme } from '@/Lib/ThemeContext';
import { TYPE_LABELS } from '@/Lib/budgetTypeLabels';
import BudgetGlassView from './GlassView';
import { router, useForm } from '@inertiajs/react';

const selectClasses =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

function AccountForm() {
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
                <InputLabel htmlFor="account_name" value="Account name" />
                <TextInput
                    id="account_name"
                    className="mt-1 block w-full"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Cash, Savings…"
                    required
                />
                <InputError className="mt-2" message={errors.name} />
            </div>
            <PrimaryButton disabled={processing}>Add account</PrimaryButton>
        </form>
    );
}

function TransactionForm({ accounts }) {
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
                <InputLabel htmlFor="tx_account" value="Account" />
                <select
                    id="tx_account"
                    className={selectClasses}
                    value={data.account_id}
                    onChange={(e) => setData('account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
                <InputError className="mt-2" message={errors.account_id} />
            </div>

            <div>
                <InputLabel htmlFor="tx_type" value="Type" />
                <select
                    id="tx_type"
                    className={selectClasses}
                    value={data.type}
                    onChange={(e) => setData('type', e.target.value)}
                >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                </select>
                <InputError className="mt-2" message={errors.type} />
            </div>

            <div>
                <InputLabel htmlFor="tx_amount" value="Amount (ZAR)" />
                <TextInput
                    id="tx_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="mt-1 block w-full"
                    value={data.amount}
                    onChange={(e) => setData('amount', e.target.value)}
                    required
                />
                <InputError className="mt-2" message={errors.amount} />
            </div>

            <div>
                <InputLabel
                    htmlFor="tx_description"
                    value="Description (optional)"
                />
                <TextInput
                    id="tx_description"
                    className="mt-1 block w-full"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                />
                <InputError className="mt-2" message={errors.description} />
            </div>

            <PrimaryButton disabled={processing}>
                Post transaction
            </PrimaryButton>
        </form>
    );
}

function TransferForm({ accounts }) {
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
                <InputLabel htmlFor="from_account" value="From" />
                <select
                    id="from_account"
                    className={selectClasses}
                    value={data.from_account_id}
                    onChange={(e) => setData('from_account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
                <InputError className="mt-2" message={errors.from_account_id} />
            </div>

            <div>
                <InputLabel htmlFor="to_account" value="To" />
                <select
                    id="to_account"
                    className={selectClasses}
                    value={data.to_account_id}
                    onChange={(e) => setData('to_account_id', e.target.value)}
                    required
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
                <InputError className="mt-2" message={errors.to_account_id} />
            </div>

            <div>
                <InputLabel htmlFor="transfer_amount" value="Amount (ZAR)" />
                <TextInput
                    id="transfer_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="mt-1 block w-full"
                    value={data.amount}
                    onChange={(e) => setData('amount', e.target.value)}
                    required
                />
                <InputError className="mt-2" message={errors.amount} />
            </div>

            <PrimaryButton disabled={processing}>Transfer</PrimaryButton>
        </form>
    );
}

export default function Dashboard({ accounts, transactions, totalCents }) {
    const { theme } = useTheme();

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

    const deleteTransaction = (transaction) => {
        if (window.confirm('Remove this transaction?')) {
            router.delete(
                route('budget.transactions.destroy', transaction.id),
                { preserveScroll: true },
            );
        }
    };

    if (theme === 'glass') {
        return (
            <BudgetGlassView
                accounts={accounts}
                transactions={transactions}
                totalCents={totalCents}
                onDeleteAccount={deleteAccount}
                onDeleteTransaction={deleteTransaction}
            />
        );
    }

    return (
        <PageShell title="Budget">
            <div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Across all accounts
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatZar(totalCents)}
                </p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                    <div
                        key={account.id}
                        className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                {account.name}
                            </p>
                            <button
                                type="button"
                                onClick={() => deleteAccount(account)}
                                className="text-xs text-red-600 hover:underline dark:text-red-400"
                            >
                                Delete
                            </button>
                        </div>
                        <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatZar(account.balance_cents)}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mb-8 grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
                    <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                        New account
                    </h2>
                    <AccountForm />
                </div>

                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
                    <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                        Add transaction
                    </h2>
                    {accounts.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Add an account first.
                        </p>
                    ) : (
                        <TransactionForm accounts={accounts} />
                    )}
                </div>

                <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
                    <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                        Transfer money
                    </h2>
                    {accounts.length < 2 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Two accounts are needed to transfer between them.
                        </p>
                    ) : (
                        <TransferForm accounts={accounts} />
                    )}
                </div>
            </div>

            <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                Recent activity
            </h2>

            {transactions.length === 0 ? (
                <EmptyState
                    title="No transactions yet"
                    description="Deposits, withdrawals and transfers show up here."
                />
            ) : (
                <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-5 py-3">Type</th>
                                <th className="px-5 py-3">Account</th>
                                <th className="px-5 py-3">Amount</th>
                                <th className="px-5 py-3">Description</th>
                                <th className="px-5 py-3">When</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {transactions.map((transaction) => (
                                <tr key={transaction.id}>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-900 dark:text-gray-100">
                                        {TYPE_LABELS[transaction.type] ??
                                            transaction.type}
                                    </td>
                                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                                        {transaction.account}
                                        {transaction.related_account
                                            ? ` ↔ ${transaction.related_account}`
                                            : ''}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-gray-900 dark:text-gray-100">
                                        {formatZar(transaction.amount_cents)}
                                    </td>
                                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                                        {transaction.description ?? '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-400 dark:text-gray-500">
                                        {transaction.created_at}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                deleteTransaction(transaction)
                                            }
                                            className="text-red-600 hover:underline dark:text-red-400"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </PageShell>
    );
}

Dashboard.layout = (page) => {
    const submenu = getSubmenu('budget').map((item) =>
        item.target === 'transfer'
            ? {
                  ...item,
                  type: page.props.accounts.length >= 2 ? 'anchor' : 'disabled',
              }
            : item,
    );

    return (
        <AuthenticatedLayout module="budget" submenu={submenu}>
            {page}
        </AuthenticatedLayout>
    );
};
