import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { getSubmenu } from '@/Lib/glassNav';
import BudgetGlassView from './GlassView';
import { router } from '@inertiajs/react';

export default function Dashboard({ accounts, transactions, totalCents }) {
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
