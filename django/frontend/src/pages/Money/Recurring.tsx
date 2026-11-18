import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { AmountField, Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import type { MoneyChoices } from "@/components/money/TransactionDialog";
import { formatDayMonth } from "@/lib/dates";
import { centsToInput, formatSigned } from "@/lib/money";
import type { Option } from "@/lib/types";
import type { RecurringItem } from "./Overview";

type Props = MoneyChoices & { items: RecurringItem[]; today: string; editing: number | null; cadences: Option[] };
const opts = { preserveScroll: true };

export default function MoneyRecurring(p: Props) {
  const [open, setOpen] = useState<RecurringItem | "new" | null>(p.editing ? p.items.find((i) => i.id === p.editing) ?? null : null);
  const [removing, setRemoving] = useState<RecurringItem | null>(null);
  return (
    <>
      <PageHeader kicker="Money" title="Recurring" deck="Salary, rent, subscriptions. Income can post itself; spending waits for you to confirm."
        actions={<Button onClick={() => setOpen("new")}>Add recurring</Button>} />
      <MoneyNav />
      {p.items.length === 0 ? <EmptyState title="Nothing recurring yet." action={<Button onClick={() => setOpen("new")}>Add the first</Button>} /> : (
        <ul className="divide-y divide-line border-y border-line">
          {p.items.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 py-4 ${r.active ? "" : "opacity-60"}`}>
              <div className="min-w-[200px] flex-1">
                <p className="font-semibold">{r.name}{" "}
                  {r.due && <Badge tone={r.next_date < p.today ? "neg" : "warn"}>{r.next_date < p.today ? "Overdue" : "Due"}</Badge>}{" "}
                  {r.auto_post && <Badge>Auto</Badge>} {!r.active && <Badge>Paused</Badge>}
                </p>
                <p className="text-[13px] text-muted">{p.cadences.find((c) => c.value === r.cadence)?.label} · next {formatDayMonth(r.next_date)} · {r.account.name}</p>
              </div>
              <span className={`num w-28 text-right ${r.amount_cents > 0 ? "text-pos" : ""}`}>{formatSigned(r.amount_cents)}</span>
              {r.due && <>
                <Button size="sm" onClick={() => router.post(`/money/recurring/${r.id}/confirm/`, {}, opts)}>Paid</Button>
                <Button size="sm" variant="ghost" onClick={() => router.post(`/money/recurring/${r.id}/skip/`, {}, opts)}>Skip</Button>
              </>}
              <Button size="sm" variant="secondary" onClick={() => setOpen(r)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(r)} aria-label={`Delete ${r.name}`}>×</Button>
            </li>
          ))}
        </ul>
      )}
      {open && <RecurringDialog item={open === "new" ? null : open} {...p} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.name}?`}
        body="Transactions it already posted stay in your ledger." confirmLabel="Delete"
        onConfirm={() => removing && router.delete(`/money/recurring/${removing.id}/`)} />
    </>
  );
}

function RecurringDialog({ item, account_options, category_options, cadences, today, onClose }:
  Props & { item: RecurringItem | null; onClose: () => void }) {
  const form = useForm({
    name: item?.name ?? "", amount: item ? centsToInput(item.amount_cents) : "", direction: item && item.amount_cents > 0 ? "in" : "out",
    cadence: item?.cadence ?? "monthly", next_date: item?.next_date ?? today,
    account: String(item?.account.id ?? account_options[0]?.id ?? ""), category: item?.category ? String(item.category.id) : "",
    auto_post: item?.auto_post ?? false, active: item?.active ?? true,
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (item) form.put(`/money/recurring/${item.id}/`, { onSuccess: onClose });
    else form.post("/money/recurring/", { onSuccess: onClose });
  };
  return (
    <Dialog open title={item ? "Edit recurring" : "Add recurring"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Segmented label="Direction" value={form.data.direction} onChange={(v) => form.setData("direction", v)}
          options={[{ value: "out", label: "Money out" }, { value: "in", label: "Money in" }]} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus placeholder="e.g. Rent" />
        <div className="grid grid-cols-2 gap-3">
          <AmountField label="Amount (R)" value={form.data.amount} onChange={(v) => form.setData("amount", v)} error={form.errors.amount} />
          <Select label="How often" value={form.data.cadence} onChange={(v) => form.setData("cadence", v)} options={cadences} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Next date" type="date" value={form.data.next_date} onChange={(v) => form.setData("next_date", v)} error={form.errors.next_date} />
          <Select label="Account" value={form.data.account} onChange={(v) => form.setData("account", v)} error={form.errors.account}
            options={account_options.map((a) => ({ value: a.id, label: a.name }))} />
        </div>
        <Select label="Category" value={form.data.category} onChange={(v) => form.setData("category", v)} placeholder="Uncategorised"
          options={category_options.map((c) => ({ value: c.id, label: c.name }))} />
        <Checkbox label="Post it automatically" hint="Good for salary. Spending is safer confirmed by you."
          checked={form.data.auto_post} onChange={(v) => form.setData("auto_post", v)} />
        <Checkbox label="Active" checked={form.data.active} onChange={(v) => form.setData("active", v)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
