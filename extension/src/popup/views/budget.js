import { api } from '../../lib/api.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatZar, formatWhen, transferFlow, TYPE_LABELS, isCredit } from '../../lib/format.js';

function accountOptions(accounts, selectedId) {
    return accounts.map((account) =>
        h('option', {
            value: account.id,
            selected: account.id === selectedId,
            text: `${account.name} · ${formatZar(account.balance_cents)}`,
        }),
    );
}

export async function renderBudget(view, rerender) {
    clear(view).append(muted('Loading budget…'));

    const [accounts, transactions] = await Promise.all([
        api.budgetAccounts(),
        api.budgetTransactions(),
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

    // New account
    view.append(
        h('form', {
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
        }, [
            h('label', { text: 'New account' }, [
                h('input', { name: 'name', required: true, placeholder: 'Cash, Savings…' }),
            ]),
            h('button', { class: 'btn', type: 'submit', text: 'Add account' }),
        ]),
    );

    if (accounts.length > 0) {
        view.append(
            h('form', {
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
            }, [
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
                h('label', { text: 'Description (optional)' }, [h('input', { name: 'description' })]),
                h('button', { class: 'btn', type: 'submit', text: 'Post transaction' }),
            ]),
        );
    }

    if (accounts.length >= 2) {
        view.append(
            h('form', {
                class: 'card stack',
                onSubmit: (event) => {
                    event.preventDefault();
                    const form = event.target;
                    const from = form.elements.from.value;
                    const to = form.elements.to.value;
                    // The server rejects this too; stopping here saves a round trip.
                    if (from === to) {
                        view.prepend(h('div', { class: 'alert', text: 'Pick two different accounts.' }));
                        return;
                    }
                    guard(view, async () => {
                        await api.transfer(from, to, form.elements.amount.value, form.elements.description.value);
                        await rerender();
                    });
                },
            }, [
                h('div', { class: 'split' }, [
                    h('label', { text: 'From' }, [
                        h('select', { name: 'from' }, accountOptions(accounts, accounts[0]?.id)),
                    ]),
                    h('label', { text: 'To' }, [
                        h('select', { name: 'to' }, accountOptions(accounts, accounts[1]?.id)),
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
                h('label', { text: 'Description (optional)' }, [h('input', { name: 'description' })]),
                h('button', { class: 'btn', type: 'submit', text: 'Transfer' }),
            ]),
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
                    h('div', { class: 'muted truncate', text: transferFlow(transaction) }),
                    transaction.description
                        ? h('div', { class: 'muted truncate', text: transaction.description })
                        : null,
                    h('div', { class: 'muted', text: formatWhen(transaction.created_at) }),
                ]),
                h('span', {
                    class: 'amount',
                    text: (isCredit(transaction.type) ? '+' : '−') + formatZar(transaction.amount_cents),
                }),
            ]),
        );
    }
}
