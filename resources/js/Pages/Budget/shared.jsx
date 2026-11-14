import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { ArrowDownIcon, ArrowUpIcon, SwapIcon } from '@/Components/Glass/icons';
import { router, useForm } from '@inertiajs/react';
import { formatZar } from '@/Lib/formatZar';

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

export function GlassTransactionForm({ accounts, categories = [] }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        account_id: accounts[0]?.id ?? '',
        type: 'deposit',
        amount: '',
        description: '',
        merchant: '',
        category_id: '',
        occurred_on: new Date().toISOString().slice(0, 10),
    });

    // An income bucket cannot collect a withdrawal and vice versa; the server
    // rejects the mismatch, and the form only offers what fits.
    const kind = data.type === 'deposit' ? 'income' : 'expense';
    const matching = categories.filter((category) => category.kind === kind);

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.transactions.store'), {
            preserveScroll: true,
            onSuccess: () => reset('amount', 'description', 'merchant'),
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
                    onChange={(e) => {
                        setData('type', e.target.value);
                        setData('category_id', '');
                    }}
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
                <GlassLabel htmlFor="glass_tx_category">
                    Category (optional)
                </GlassLabel>
                <GlassSelect
                    id="glass_tx_category"
                    value={data.category_id}
                    onChange={(e) => setData('category_id', e.target.value)}
                >
                    <option value="">Uncategorized</option>
                    {matching.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.category_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_tx_occurred">Date</GlassLabel>
                <GlassInput
                    id="glass_tx_occurred"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={data.occurred_on}
                    onChange={(e) => setData('occurred_on', e.target.value)}
                />
                <GlassError message={errors.occurred_on} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_tx_merchant">
                    Merchant (optional)
                </GlassLabel>
                <GlassInput
                    id="glass_tx_merchant"
                    value={data.merchant}
                    onChange={(e) => setData('merchant', e.target.value)}
                />
                <GlassError message={errors.merchant} />
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

export const CATEGORY_KIND_LABELS = {
    expense: 'Expense',
    income: 'Income',
};

export const LIMIT_STATE_LABELS = {
    none: 'No limit',
    under: 'On track',
    near: 'Close to limit',
    over: 'Over limit',
};

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/** `2026-11` rendered as `Nov 2026`, for labels only. */
export function formatPeriodLabel(period) {
    const [year, month] = String(period ?? '').split('-');
    const index = Number(month) - 1;

    return `${MONTHS[index] ?? month} ${year}`;
}

export function categoryName(categories, id) {
    return categories.find((category) => category.id === id)?.name ?? null;
}

export function GlassCategoryForm() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        kind: 'expense',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.categories.store'), {
            preserveScroll: true,
            onSuccess: () => reset('name'),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_category_name">Name</GlassLabel>
                <GlassInput
                    id="glass_category_name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Groceries, Rent…"
                    required
                />
                <GlassError message={errors.name} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_category_kind">Kind</GlassLabel>
                <GlassSelect
                    id="glass_category_kind"
                    value={data.kind}
                    onChange={(e) => setData('kind', e.target.value)}
                >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                </GlassSelect>
                <GlassError message={errors.kind} />
            </div>
            <GlassButton type="submit" disabled={processing}>
                Add category
            </GlassButton>
        </form>
    );
}

export function GlassCategoryRow({ category }) {
    const { data, setData, put, processing, errors } = useForm({
        name: category.name,
        kind: category.kind,
    });

    const save = (event) => {
        event.preventDefault();
        put(route('budget.categories.update', category.id), {
            preserveScroll: true,
        });
    };

    const remove = () => {
        if (
            window.confirm(
                `Delete "${category.name}"? Its transactions stay, uncategorized.`,
            )
        ) {
            router.delete(route('budget.categories.destroy', category.id), {
                preserveScroll: true,
            });
        }
    };

    return (
        <form
            onSubmit={save}
            className="flex items-center gap-2 border-b border-[var(--card-border)] py-2.5 last:border-b-0"
        >
            <GlassInput
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
                aria-label={`Name for ${category.name}`}
                required
            />
            <GlassSelect
                value={data.kind}
                onChange={(e) => setData('kind', e.target.value)}
                aria-label={`Kind for ${category.name}`}
                className="w-28 shrink-0"
            >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
            </GlassSelect>
            <button
                type="submit"
                disabled={processing}
                className="shrink-0 text-xs text-[#8BB4FF] hover:underline"
            >
                Save
            </button>
            <button
                type="button"
                onClick={remove}
                className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
            >
                Delete
            </button>
            <GlassError message={errors.name} />
        </form>
    );
}

export function GlassLimitForm({ categories, period }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        category_id: categories[0]?.id ?? '',
        period,
        limit: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.limits.store'), {
            preserveScroll: true,
            onSuccess: () => reset('limit'),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_limit_category">Category</GlassLabel>
                <GlassSelect
                    id="glass_limit_category"
                    value={data.category_id}
                    onChange={(e) => setData('category_id', e.target.value)}
                    required
                >
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.category_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_limit_amount">
                    Monthly cap (ZAR)
                </GlassLabel>
                <GlassInput
                    id="glass_limit_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={data.limit}
                    onChange={(e) => setData('limit', e.target.value)}
                    required
                />
                <GlassError message={errors.limit} />
            </div>
            <p className="text-[11px] text-[var(--muted)]">
                Saving again for the same category and month replaces that
                month&apos;s cap.
            </p>
            <GlassButton type="submit" disabled={processing}>
                Save cap
            </GlassButton>
        </form>
    );
}

export function GlassGoalForm({ accounts }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        target: '',
        saved: '',
        account_id: '',
        target_date: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('budget.goals.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="glass_goal_name">Goal</GlassLabel>
                <GlassInput
                    id="glass_goal_name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Emergency fund"
                    required
                />
                <GlassError message={errors.name} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_goal_target">
                    Target (ZAR)
                </GlassLabel>
                <GlassInput
                    id="glass_goal_target"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={data.target}
                    onChange={(e) => setData('target', e.target.value)}
                    required
                />
                <GlassError message={errors.target} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_goal_saved">
                    Already saved (ZAR)
                </GlassLabel>
                <GlassInput
                    id="glass_goal_saved"
                    type="number"
                    step="0.01"
                    min="0"
                    value={data.saved}
                    onChange={(e) => setData('saved', e.target.value)}
                />
                <GlassError message={errors.saved} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_goal_account">
                    Funded from (optional)
                </GlassLabel>
                <GlassSelect
                    id="glass_goal_account"
                    value={data.account_id}
                    onChange={(e) => setData('account_id', e.target.value)}
                >
                    <option value="">No account</option>
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.account_id} />
            </div>
            <div>
                <GlassLabel htmlFor="glass_goal_date">
                    Target date (optional)
                </GlassLabel>
                <GlassInput
                    id="glass_goal_date"
                    type="date"
                    value={data.target_date}
                    onChange={(e) => setData('target_date', e.target.value)}
                />
                <GlassError message={errors.target_date} />
            </div>
            <GlassButton type="submit" disabled={processing}>
                Add goal
            </GlassButton>
        </form>
    );
}

/**
 * A cap's progress against what has been spent. `percent` comes from the
 * server (BudgetRules), so the bar and the label cannot disagree.
 */
export function LimitMeter({ limit }) {
    const width = Math.min(100, Math.max(0, limit.percent));
    const tone =
        limit.state === 'over'
            ? 'var(--neg)'
            : limit.state === 'near'
              ? '#C08A2E'
              : 'var(--pos)';

    return (
        <div className="border-b border-[var(--card-border)] py-2.5 last:border-b-0">
            <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-semibold">{limit.category}</span>
                <span className="tabular-nums text-[var(--muted)]">
                    {formatZar(limit.spent_cents)} of{' '}
                    {formatZar(limit.limit_cents)}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--card-border)]">
                <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: tone }}
                />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--muted)]">
                <span>{LIMIT_STATE_LABELS[limit.state] ?? limit.state}</span>
                <span className="tabular-nums">{limit.percent}%</span>
            </div>
        </div>
    );
}

/**
 * Income against expenses for the months the server sent. Hand-rolled SVG:
 * the axis is labelled with text, so no chart library and no canvas.
 */
export function InOutBars({ series, height = 150 }) {
    if (!series || series.length === 0) {
        return (
            <p className="text-sm text-[var(--muted)]">
                Nothing to chart for this period.
            </p>
        );
    }

    const width = 340;
    const baseline = height - 22;
    const top = 8;
    const slot = width / series.length;
    const barWidth = Math.max(6, Math.min(16, slot / 3));
    const max = Math.max(
        1,
        ...series.flatMap((month) => [month.income_cents, month.expense_cents]),
    );

    return (
        <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Income against expenses by month"
        >
            {series.map((month, index) => {
                const center = slot * index + slot / 2;
                const incomeHeight =
                    ((baseline - top) * month.income_cents) / max;
                const expenseHeight =
                    ((baseline - top) * month.expense_cents) / max;

                return (
                    <g key={month.period}>
                        <rect
                            x={center - barWidth - 1}
                            y={baseline - incomeHeight}
                            width={barWidth}
                            height={Math.max(1, incomeHeight)}
                            rx={2}
                            fill="#1D9E75"
                        />
                        <rect
                            x={center + 1}
                            y={baseline - expenseHeight}
                            width={barWidth}
                            height={Math.max(1, expenseHeight)}
                            rx={2}
                            fill="#D4537E"
                        />
                        <text
                            x={center}
                            y={height - 6}
                            textAnchor="middle"
                            fontSize="9"
                            fill="currentColor"
                            opacity="0.65"
                        >
                            {MONTHS[Number(month.period.slice(5, 7)) - 1] ??
                                month.period}
                        </text>
                    </g>
                );
            })}
            <line
                x1={0}
                y1={baseline}
                x2={width}
                y2={baseline}
                stroke="currentColor"
                strokeOpacity="0.2"
            />
        </svg>
    );
}

/** Bills inside their reminder window and caps near or over, from the server. */
export function DueList({ due }) {
    if (!due || (due.bills.length === 0 && due.limits.length === 0)) {
        return (
            <p className="text-sm text-[var(--muted)]">
                Nothing due. Recurring bills with a reminder window and caps at
                80% or more show up here.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {due.bills.map((bill) => (
                <div
                    key={bill.id}
                    className="flex items-center justify-between text-[12.5px]"
                >
                    <span className="truncate">
                        {bill.description ?? 'Recurring item'}
                        <span className="text-[var(--muted)]">
                            {' '}
                            {bill.days_until_due === 0
                                ? 'due today'
                                : bill.days_until_due > 0
                                  ? `in ${bill.days_until_due} day${bill.days_until_due === 1 ? '' : 's'}`
                                  : `${Math.abs(bill.days_until_due)} day${Math.abs(bill.days_until_due) === 1 ? '' : 's'} late`}
                        </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                        {formatZar(bill.amount_cents)}
                    </span>
                </div>
            ))}
            {due.limits.map((limit) => (
                <div
                    key={limit.id}
                    className="flex items-center justify-between text-[12.5px]"
                >
                    <span className="truncate">
                        {limit.category}
                        <span className="text-[var(--muted)]">
                            {' '}
                            {LIMIT_STATE_LABELS[limit.state] ?? limit.state}
                        </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                        {formatZar(limit.spent_cents)} /{' '}
                        {formatZar(limit.limit_cents)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/**
 * Attach, view or remove the one receipt a transaction can have.
 *
 * The file goes straight to the private-disk upload route; the add-on has no
 * equivalent because an extension cannot read a local image the same way.
 */
export function ReceiptControl({ transaction }) {
    const upload = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        router.post(
            route('budget-receipts.store', transaction.id),
            { receipt: file },
            { forceFormData: true, preserveScroll: true },
        );

        event.target.value = '';
    };

    const remove = () => {
        if (window.confirm('Remove this receipt?')) {
            router.delete(
                route('budget-receipts.destroy', transaction.receipt.id),
                { preserveScroll: true },
            );
        }
    };

    return (
        <div className="ml-2 flex shrink-0 items-center gap-2 text-xs">
            {transaction.receipt && (
                <a
                    href={transaction.receipt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#8BB4FF] hover:underline"
                >
                    View
                </a>
            )}
            <label className="cursor-pointer text-[var(--muted)] hover:text-[var(--ink)]">
                {transaction.receipt ? 'Replace' : 'Receipt'}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={upload}
                />
            </label>
            {transaction.receipt && (
                <button
                    type="button"
                    onClick={remove}
                    className="text-[var(--muted)] hover:text-[var(--neg)]"
                >
                    Remove
                </button>
            )}
        </div>
    );
}
