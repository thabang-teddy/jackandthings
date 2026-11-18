import { router } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReceiptDialog, TransactionDialog, type MoneyChoices, type Tx } from "@/components/money/TransactionDialog";
import { Badge, Swatch } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Pager } from "@/components/ui/Pager";
import { Select } from "@/components/ui/Select";
import { formatLongDay } from "@/lib/dates";
import { formatSigned, formatZar } from "@/lib/money";
import type { Paged } from "@/lib/types";

type Filters = { from: string; to: string; account: string; category: string; direction: string; q: string };
type Props = Paged<Tx> & MoneyChoices & { totals: { out_cents: number; in_cents: number }; filters: Filters; today: string; editing?: number };

export default function MoneyTransactions(p: Props) {
  const [f, setF] = useState<Filters>(p.filters);
  const [editing, setEditing] = useState<Tx | "new" | null>(p.editing ? p.items.find((t) => t.id === p.editing) ?? null : null);
  const [receipt, setReceipt] = useState<Tx | null>(null);
  const apply = (next: Filters) => {
    setF(next);
    const query = Object.fromEntries(Object.entries(next).filter(([, v]) => v));
    router.get("/money/transactions/", query, { preserveState: true, replace: true });
  };
  const set = (k: keyof Filters) => (v: string) => apply({ ...f, [k]: v });
  const csv = `/money/transactions.csv?${new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()}`;

  // Group by day for the mobile list and the desktop table alike.
  const days: { date: string; items: Tx[] }[] = [];
  for (const t of p.items) {
    const last = days[days.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else days.push({ date: t.date, items: [t] });
  }

  return (
    <>
      <PageHeader kicker="Money" title="Transactions" actions={<>
        <a href={csv} className="inline-flex h-10 items-center border border-text px-4 text-sm font-semibold hover:bg-tint">Export CSV</a>
        <Button onClick={() => setEditing("new")}>Add transaction</Button>
      </>} />
      <MoneyNav />
      <form className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
        <Field label="Search" type="search" value={f.q} onChange={(v) => setF({ ...f, q: v })} onBlur={() => apply(f)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(f); }} />
        <Field label="From" type="date" value={f.from} onChange={set("from")} />
        <Field label="To" type="date" value={f.to} onChange={set("to")} />
        <Select label="Account" value={f.account} onChange={set("account")} placeholder="All accounts"
          options={p.account_options.map((a) => ({ value: a.id, label: a.name }))} />
        <Select label="Category" value={f.category} onChange={set("category")} placeholder="All categories"
          options={p.category_options.map((c) => ({ value: c.id, label: c.name }))} />
        <Select label="Direction" value={f.direction} onChange={set("direction")} placeholder="In and out"
          options={[{ value: "out", label: "Money out" }, { value: "in", label: "Money in" }]} />
      </form>
      <p className="mb-4 text-sm"><span className="text-muted">Out</span> <b className="num">{formatZar(p.totals.out_cents)}</b> ·{" "}
        <span className="text-muted">In</span> <b className="num text-pos">{formatZar(p.totals.in_cents)}</b>
        <span className="text-muted"> · transfers excluded</span></p>

      {p.items.length === 0 ? <EmptyState title="No transactions match." body="Change the filters, or add one." /> : (
        <div className="grid gap-6">
          {days.map((d) => (
            <section key={d.date} aria-label={formatLongDay(d.date)}>
              <h2 className="kicker border-b border-line pb-1.5">{formatLongDay(d.date)}</h2>
              <ul className="divide-y divide-line">
                {d.items.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <Swatch colour={t.category?.colour ?? "#8E887B"} glyph={t.transfer ? "⇄" : t.category?.glyph ?? "·"} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                      <span className="block truncate font-medium hover:underline">{t.description}</span>
                      <span className="block text-[12px] text-muted">
                        {t.account.name}{t.category ? ` · ${t.category.name}` : ""}{t.transfer && " · transfer"}
                      </span>
                    </button>
                    <button className="text-[12px] text-muted underline" onClick={() => setReceipt(t)}
                      aria-label={t.receipt_id ? `View receipt for ${t.description}` : `Add receipt for ${t.description}`}>
                      {t.receipt_id ? <Badge>Receipt</Badge> : "+ Receipt"}
                    </button>
                    <span className={`num w-28 text-right ${t.amount_cents > 0 ? "text-pos" : ""}`}>{formatSigned(t.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Pager page={p.page} pages={p.pages} total={p.total} noun="transactions" />
      {editing && (editing === "new" || !editing.transfer)
        ? <TransactionDialog tx={editing === "new" ? null : editing} choices={p} onClose={() => setEditing(null)} />
        : editing && <TransferNotice tx={editing} onClose={() => setEditing(null)} />}
      {receipt && <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function TransferNotice({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="Transfer" className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md border-t-[3px] border-accent bg-surface2 p-5 shadow-lg md:bottom-8">
      <p className="font-semibold">{tx.description}</p>
      <p className="mt-1 text-sm text-muted">Transfers can't be edited. Delete it (both sides go) and move the money again.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="danger" onClick={() => { router.delete(`/money/transactions/${tx.id}/`, { preserveScroll: true }); onClose(); }}>Delete transfer</Button>
      </div>
    </div>
  );
}
