import { useForm } from "@inertiajs/react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AmountField, Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { formatZar } from "@/lib/money";
import type { Account } from "./Overview";

export default function MoneyTransfer({ accounts, today }: { accounts: Account[]; today: string }) {
  const form = useForm({ source: String(accounts[0]?.id ?? ""), target: String(accounts[1]?.id ?? ""), amount: "", date: today, note: "" });
  const opts = accounts.map((a) => ({ value: a.id, label: `${a.name} — ${formatZar(a.balance_cents)}` }));
  return (
    <>
      <PageHeader kicker="Money" title="Move money" deck="Between your own accounts. Both sides are saved together, or not at all." />
      <MoneyNav />
      {accounts.length < 2 ? <p className="text-muted">You need two accounts to move money between them.</p> : (
        <form className="grid max-w-lg gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/money/transfer/"); }}>
          <FormError errors={form.errors as Record<string, string>} />
          <Select label="From" value={form.data.source} onChange={(v) => form.setData("source", v)} options={opts} error={form.errors.source} />
          <Select label="To" value={form.data.target} onChange={(v) => form.setData("target", v)} options={opts} error={form.errors.target} />
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="Amount (R)" value={form.data.amount} onChange={(v) => form.setData("amount", v)} error={form.errors.amount} />
            <Field label="Date" type="date" value={form.data.date} onChange={(v) => form.setData("date", v)} error={form.errors.date} />
          </div>
          <Field label="Note" value={form.data.note} onChange={(v) => form.setData("note", v)} hint="Optional." />
          <Button type="submit" loading={form.processing}>Move money</Button>
        </form>
      )}
    </>
  );
}
