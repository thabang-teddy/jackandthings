import { api } from '../../lib/api.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatZar, formatWhen, transferFlow, TYPE_LABELS, isCredit } from '../../lib/format.js';
import { limitPercent, limitState } from '../../lib/budgetRules.js';

const STATE_LABELS = {
    none: 'No cap',
    under: 'On track',
    near: 'Close to the cap',
    over: 'Over the cap',
};

/** Only the two states that need a second colour get one. */
const STATE_TONES = {
    over: 'var(--danger)',
    near: '#c08a2e',
};

function accountOptions(accounts, selectedId) {
    return accounts.map((account) =>
        h('option', {
            value: account.id,
            selected: account.id === selectedId,
            text: `${account.name} · ${formatZar(account.balance_cents)}`,
        }),
    );
}

/**
 * Today on this machine's calendar, not UTC. A popup opened at 23:30 has to
 * file the expense under the day the user is living in, and `toISOString()`
 * would already have rolled over.
 */
function localDay(now = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A `YYYY-MM-DD` business date without the time the parse would invent. */
function formatDay(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/**
 * One cap and how much of it this month has used. The bar's width and tone
 * come from the shared rule (`lib/budgetRules.js`), so the popup cannot
 * disagree with the web app about what "close to the cap" means.
 */
function limitMeter(limit) {
    const state = limitState(limit.spent_cents, limit.limit_cents);
    const percent = limitPercent(limit.spent_cents, limit.limit_cents);
    const width = Math.min(100, Math.max(0, percent));

    return h('div', { class: 'card' }, [
        h('div', { class: 'row' }, [
            h('div', { class: 'grow' }, [h('strong', { text: limit.category ?? 'Category' })]),
            h('span', {
                class: 'amount muted',
                text: `${formatZar(limit.spent_cents)} of ${formatZar(limit.limit_cents)}`,
            }),
        ]),
        h('div', { class: 'meter' }, [
            h('div', {
                class: 'meter-fill',
                style: `width: ${width}%; background: ${STATE_TONES[state] ?? 'var(--ok)'}`,
            }),
        ]),
        h('div', { class: 'row muted small' }, [
            h('span', { class: 'grow', text: STATE_LABELS[state] ?? state }),
            h('span', { class: 'amount', text: `${percent}%` }),
        ]),
    ]);
}

/**
 * The add-on's share of Budget: log a spend against a category, and see where
 * the month's caps stand. Caps are set, reports read and receipts attached on
 * the web app and the phone, where there is room for them; a popup is for the
 * expense you just paid for.
 */
function quickExpenseForm(view, rerender, accounts, expenseCategories) {
    const today = localDay();

    return h(
        'form',
        {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const merchant = form.elements.merchant.value.trim();

                guard(view, async () => {
                    await api.createTransaction(
                        form.elements.account.value,
                        'withdrawal',
                        form.elements.amount.value,
                        null,
                        {
                            occurredOn: form.elements.occurred_on.value || null,
                            merchant: merchant || null,
                            categoryId: form.elements.category.value || null,
                        },
                    );
                    await rerender();
                });
            },
        },
        [
            h('strong', { text: 'Quick expense' }),
            h('label', { text: 'Account' }, [
                h('select', { name: 'account' }, accountOptions(accounts, accounts[0]?.id)),
            ]),
            h('label', { text: 'Category' }, [
                h(
                    'select',
                    { name: 'category' },
                    expenseCategories.map((category) =>
                        h('option', { value: category.id, text: category.name }),
                    ),
                ),
            ]),
            h('div', { class: 'split' }, [
                h('label', { text: 'Amount (ZAR)' }, [
                    h('input', {
                        name: 'amount',
                        type: 'number',
                        step: '0.01',
                        min: '0.01',
                        required: true,
                    }),
                ]),
                h('label', { text: 'Date' }, [
                    h('input', {
                        name: 'occurred_on',
                        type: 'date',
                        value: today,
                        max: today,
                        required: true,
                    }),
                ]),
            ]),
            h('label', { text: 'Merchant (optional)' }, [
                h('input', { name: 'merchant', maxlength: '120' }),
            ]),
            h('button', { class: 'btn', type: 'submit', text: 'Log expense' }),
        ],
    );
}

export async function renderBudget(view, rerender) {
    clear(view).append(muted('Loading budget…'));

    const period = localDay().slice(0, 7);

    // The ledger has to render even if the planning reads fail, so only the
    // two are allowed to come back empty rather than rejecting the page.
    const [accounts, transactions, categories, limits] = await Promise.all([
        api.budgetAccounts(),
        api.budgetTransactions(),
        api.budgetCategories().catch(() => null),
        api.budgetLimits(period).catch(() => null),
    ]);

    clear(view);

    const total = accounts.reduce((sum, account) => sum + Number(account.balance_cents || 0), 0);

    view.append(
        h('div', { class: 'card' }, [
            h('div', { class: 'muted', text: 'Across all accounts' }),
            h('div', { class: 'total', text: formatZar(total) }),
        ]),
    );

    for (const account of accounts) {
        view.append(
            h('div', { class: 'card row' }, [
                h('div', { class: 'grow' }, [h('strong', { text: account.name })]),
                h('span', { class: 'amount', text: formatZar(account.balance_cents) }),
            ]),
        );
    }

    if (Array.isArray(limits)) {
        view.append(h('h2', { text: `Caps for ${period}` }));

        if (limits.length === 0) {
            view.append(
                muted('No caps for this month. Caps are set in the web app or on the phone.'),
            );
        }

        for (const limit of limits) view.append(limitMeter(limit));
    }

    const expenseCategories = (categories ?? []).filter((category) => category.kind === 'expense');

    if (accounts.length > 0 && expenseCategories.length > 0) {
        view.append(quickExpenseForm(view, rerender, accounts, expenseCategories));
    }

    // New account
    view.append(
        h(
            'form',
            {
                class: 'card stack',
                onSubmit: (event) => {
                    event.preventDefault();
                    const name = event.target.elements.name.value.trim();
                    if (!name) return;
                    guard(view, async () => {
                        await api.createBudgetAccount(name);
                        await rerender();
                    });
                },
            },
            [
                h('label', { text: 'New account' }, [
                    h('input', { name: 'name', required: true, placeholder: 'Cash, Savings…' }),
                ]),
                h('button', { class: 'btn', type: 'submit', text: 'Add account' }),
            ],
        ),
    );

    if (accounts.length > 0) {
        view.append(
            h(
                'form',
                {
                    class: 'card stack',
                    onSubmit: (event) => {
                        event.preventDefault();
                        const form = event.target;
                        guard(view, async () => {
                            await api.createTransaction(
                                form.elements.account.value,
                                form.elements.type.value,
                                form.elements.amount.value,
                                form.elements.description.value,
                            );
                            await rerender();
                        });
                    },
                },
                [
                    h('label', { text: 'Account' }, [
                        h('select', { name: 'account' }, accountOptions(accounts, accounts[0]?.id)),
                    ]),
                    h('div', { class: 'split' }, [
                        h('label', { text: 'Type' }, [
                            h('select', { name: 'type' }, [
                                h('option', { value: 'deposit', text: 'Deposit' }),
                                h('option', { value: 'withdrawal', text: 'Withdrawal' }),
                            ]),
                        ]),
                        h('label', { text: 'Amount (ZAR)' }, [
                            h('input', {
                                name: 'amount',
                                type: 'number',
                                step: '0.01',
                                min: '0.01',
                                required: true,
                            }),
                        ]),
                    ]),
                    h('label', { text: 'Description (optional)' }, [
                        h('input', { name: 'description' }),
                    ]),
                    h('button', { class: 'btn', type: 'submit', text: 'Post transaction' }),
                ],
            ),
        );
    }

    if (accounts.length >= 2) {
        view.append(
            h(
                'form',
                {
                    class: 'card stack',
                    onSubmit: (event) => {
                        event.preventDefault();
                        const form = event.target;
                        const from = form.elements.from.value;
                        const to = form.elements.to.value;
                        // The server rejects this too; stopping here saves a round trip.
                        if (from === to) {
                            view.prepend(
                                h('div', { class: 'alert', text: 'Pick two different accounts.' }),
                            );
                            return;
                        }
                        guard(view, async () => {
                            await api.transfer(
                                from,
                                to,
                                form.elements.amount.value,
                                form.elements.description.value,
                            );
                            await rerender();
                        });
                    },
                },
                [
                    h('div', { class: 'split' }, [
                        h('label', { text: 'From' }, [
                            h(
                                'select',
                                { name: 'from' },
                                accountOptions(accounts, accounts[0]?.id),
                            ),
                        ]),
                        h('label', { text: 'To' }, [
                            h(
                                'select',
                                { name: 'to' },
                                accountOptions(accounts, accounts[1]?.id),
                            ),
                        ]),
                    ]),
                    h('label', { text: 'Amount (ZAR)' }, [
                        h('input', {
                            name: 'amount',
                            type: 'number',
                            step: '0.01',
                            min: '0.01',
                            required: true,
                        }),
                    ]),
                    h('label', { text: 'Description (optional)' }, [
                        h('input', { name: 'description' }),
                    ]),
                    h('button', { class: 'btn', type: 'submit', text: 'Transfer' }),
                ],
            ),
        );
    }

    if (transactions.length > 0) {
        view.append(h('h2', { text: 'Recent activity' }));
    }

    for (const transaction of transactions.slice(0, 20)) {
        view.append(
            h('div', { class: 'card row' }, [
                h('div', { class: 'grow' }, [
                    h('strong', { text: TYPE_LABELS[transaction.type] ?? transaction.type }),
                    transaction.category
                        ? h('span', { class: 'chip', text: transaction.category })
                        : null,
                    h('div', {
                        class: 'muted truncate',
                        text: transaction.merchant ?? transferFlow(transaction),
                    }),
                    transaction.merchant
                        ? h('div', { class: 'muted truncate', text: transferFlow(transaction) })
                        : null,
                    transaction.description
                        ? h('div', { class: 'muted truncate', text: transaction.description })
                        : null,
                    h('div', {
                        class: 'muted',
                        text: formatDay(transaction.occurred_on) || formatWhen(transaction.created_at),
                    }),
                ]),
                h('span', {
                    class: 'amount',
                    text: (isCredit(transaction.type) ? '+' : '−') + formatZar(transaction.amount_cents),
                }),
            ]),
        );
    }
}
