import GlassCard from '@/Components/Glass/GlassCard';
import TxRow from '@/Components/Glass/TxRow';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { formatZar } from '@/Lib/formatZar';
import { TYPE_LABELS } from '@/Lib/budgetTypeLabels';
import { budgetLayout, INCOME_TYPES, txIcon } from './shared';

const CADENCE_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function today() {
    return new Date().toISOString().slice(0, 10);
}

const REMINDER_LABELS = {
    '': 'No reminder',
    0: 'On the day',
    1: '1 day before',
    3: '3 days before',
    7: '7 days before',
};

export default function Recurring({ accounts, categories, recurring }) {
    const [editingId, setEditingId] = useState(null);
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        useForm({
            account_id: accounts[0]?.id ?? '',
            type: 'deposit',
            amount: '',
            description: '',
            category_id: '',
            cadence: 'monthly',
            next_run_at: today(),
            remind_days_before: '',
        });

    const startNew = () => {
        setEditingId(null);
        clearErrors();
        reset();
        setData('next_run_at', today());
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        clearErrors();
        setData({
            account_id: item.account_id,
            type: item.type,
            amount: (item.amount_cents / 100).toString(),
            description: item.description ?? '',
            category_id: item.category_id ?? '',
            cadence: item.cadence,
            next_run_at: item.next_run_at,
            remind_days_before:
                item.remind_days_before === null ||
                item.remind_days_before === undefined
                    ? ''
                    : String(item.remind_days_before),
        });
    };

    const submit = (event) => {
        event.preventDefault();
        const onSuccess = () => startNew();

        if (editingId) {
            put(route('budget.recurring.update', editingId), {
                preserveScroll: true,
                onSuccess,
            });
        } else {
            post(route('budget.recurring.store'), {
                preserveScroll: true,
                onSuccess,
            });
        }
    };

    const kind = data.type === 'deposit' ? 'income' : 'expense';
    const matching = categories.filter((category) => category.kind === kind);

    const toggleActive = (item) => {
        router.put(
            route('budget.recurring.update', item.id),
            { active: !item.active },
            { preserveScroll: true },
        );
    };

    const destroy = (item) => {
        if (window.confirm('Remove this recurring item?')) {
            router.delete(route('budget.recurring.destroy', item.id), {
                preserveScroll: true,
                onSuccess: () => {
                    if (editingId === item.id) {
                        startNew();
                    }
                },
            });
        }
    };

    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard
                title="Scheduled"
                className="min-h-0 overflow-y-auto lg:col-span-2"
            >
                {accounts.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        <Link
                            href={route('budget.cards')}
                            className="font-semibold text-[var(--accent)] hover:underline"
                        >
                            Add an account
                        </Link>{' '}
                        before scheduling.
                    </p>
                ) : recurring.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Nothing scheduled yet. Recurring deposits and
                        withdrawals post automatically when they fall due.
                    </p>
                ) : (
                    recurring.map((item) => {
                        const { icon, color } = txIcon(item.type);
                        return (
                            <TxRow
                                key={item.id}
                                icon={icon}
                                iconColor={color}
                                title={`${TYPE_LABELS[item.type] ?? item.type} · ${CADENCE_LABELS[item.cadence]}`}
                                subtitle={`${item.account}${item.category ? ` · ${item.category}` : ''} · next ${item.next_run_at}${item.remind_days_before === null || item.remind_days_before === undefined ? '' : ` · remind ${item.remind_days_before}d before`}${item.active ? '' : ' · paused'}`}
                                trailing={formatZar(item.amount_cents)}
                                trailingTone={
                                    INCOME_TYPES.has(item.type) ? 'pos' : 'neg'
                                }
                                action={
                                    <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(item)}
                                            className="text-[var(--muted)] hover:text-[var(--ink)]"
                                        >
                                            {item.active ? 'Pause' : 'Resume'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startEdit(item)}
                                            className={
                                                'hover:underline ' +
                                                (editingId === item.id
                                                    ? 'font-bold text-[var(--accent)]'
                                                    : 'text-[#8BB4FF]')
                                            }
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => destroy(item)}
                                            className="text-[var(--muted)] hover:text-[var(--neg)]"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                }
                            />
                        );
                    })
                )}
            </GlassCard>

            <GlassCard title={editingId ? 'Edit schedule' : 'New schedule'}>
                {accounts.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Add an account first.
                    </p>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <div>
                            <GlassLabel htmlFor="rec_account">
                                Account
                            </GlassLabel>
                            <GlassSelect
                                id="rec_account"
                                value={data.account_id}
                                onChange={(e) =>
                                    setData('account_id', e.target.value)
                                }
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
                            <GlassLabel htmlFor="rec_type">Type</GlassLabel>
                            <GlassSelect
                                id="rec_type"
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
                            <GlassLabel htmlFor="rec_amount">
                                Amount (ZAR)
                            </GlassLabel>
                            <GlassInput
                                id="rec_amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={data.amount}
                                onChange={(e) =>
                                    setData('amount', e.target.value)
                                }
                                required
                            />
                            <GlassError message={errors.amount} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="rec_category">
                                Category (optional)
                            </GlassLabel>
                            <GlassSelect
                                id="rec_category"
                                value={data.category_id}
                                onChange={(e) =>
                                    setData('category_id', e.target.value)
                                }
                            >
                                <option value="">Uncategorized</option>
                                {matching.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </GlassSelect>
                            <GlassError message={errors.category_id} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="rec_reminder">
                                Reminder
                            </GlassLabel>
                            <GlassSelect
                                id="rec_reminder"
                                value={data.remind_days_before}
                                onChange={(e) =>
                                    setData(
                                        'remind_days_before',
                                        e.target.value,
                                    )
                                }
                            >
                                {Object.entries(REMINDER_LABELS).map(
                                    ([value, label]) => (
                                        <option
                                            key={value || 'none'}
                                            value={value}
                                        >
                                            {label}
                                        </option>
                                    ),
                                )}
                            </GlassSelect>
                            <GlassError message={errors.remind_days_before} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="rec_cadence">
                                Cadence
                            </GlassLabel>
                            <GlassSelect
                                id="rec_cadence"
                                value={data.cadence}
                                onChange={(e) =>
                                    setData('cadence', e.target.value)
                                }
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </GlassSelect>
                            <GlassError message={errors.cadence} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="rec_next">
                                First run
                            </GlassLabel>
                            <GlassInput
                                id="rec_next"
                                type="date"
                                value={data.next_run_at}
                                onChange={(e) =>
                                    setData('next_run_at', e.target.value)
                                }
                                required
                            />
                            <GlassError message={errors.next_run_at} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="rec_description">
                                Description (optional)
                            </GlassLabel>
                            <GlassInput
                                id="rec_description"
                                value={data.description}
                                onChange={(e) =>
                                    setData('description', e.target.value)
                                }
                            />
                            <GlassError message={errors.description} />
                        </div>
                        <div className="flex items-center gap-4">
                            <GlassButton type="submit" disabled={processing}>
                                {editingId ? 'Save' : 'Schedule'}
                            </GlassButton>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={startNew}
                                    className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </GlassCard>
        </div>
    );
}

Recurring.layout = budgetLayout;
