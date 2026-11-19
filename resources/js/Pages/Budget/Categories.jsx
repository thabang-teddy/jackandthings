import GlassCard from '@/Components/Glass/GlassCard';
import {
    budgetLayout,
    CATEGORY_KIND_LABELS,
    GlassCategoryForm,
    GlassCategoryRow,
} from './shared';

export default function Categories({ categories }) {
    const expenses = categories.filter(
        (category) => category.kind === 'expense',
    );
    const income = categories.filter((category) => category.kind === 'income');

    return (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard
                title="Your categories"
                className="min-h-0 overflow-y-auto lg:col-span-2"
            >
                <p className="mb-3 text-[11px] text-[var(--muted)]">
                    One name per kind, per person. Renaming a category keeps
                    every transaction filed under it.
                </p>

                {categories.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        The starter set appears the first time a budget page
                        loads.
                    </p>
                ) : (
                    <>
                        <h5 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            {CATEGORY_KIND_LABELS.expense} ({expenses.length})
                        </h5>
                        {expenses.map((category) => (
                            <GlassCategoryRow
                                key={category.id}
                                category={category}
                            />
                        ))}

                        <h5 className="mb-1 mt-4 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            {CATEGORY_KIND_LABELS.income} ({income.length})
                        </h5>
                        {income.length === 0 ? (
                            <p className="py-2 text-sm text-[var(--muted)]">
                                No income categories yet.
                            </p>
                        ) : (
                            income.map((category) => (
                                <GlassCategoryRow
                                    key={category.id}
                                    category={category}
                                />
                            ))
                        )}
                    </>
                )}
            </GlassCard>

            <GlassCard title="New category">
                <GlassCategoryForm />
            </GlassCard>
        </div>
    );
}

Categories.layout = budgetLayout;
