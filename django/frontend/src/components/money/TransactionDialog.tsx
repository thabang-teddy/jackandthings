import { router, useForm } from "@inertiajs/react";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { AmountField, Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { todayIso } from "@/lib/dates";
import { centsToInput } from "@/lib/money";

export type Tx = { id: number; date: string; description: string; amount_cents: number; account: { id: number; name: string };
  category: { id: number; name: string; colour: string; glyph: string } | null; transfer: boolean; recurring_id: number | null;
  receipt_id: number | null };
export type MoneyChoices = { account_options: { id: number; name: string; kind: string }[];
  category_options: { id: number; name: string; colour: string }[] };

export function TransactionDialog({ tx, choices, onClose }: { tx: Tx | null; choices: MoneyChoices; onClose: () => void }) {
  const form = useForm({
    date: tx?.date ?? todayIso(),
    description: tx?.description ?? "",
    amount: tx ? centsToInput(tx.amount_cents) : "",
    direction: tx && tx.amount_cents > 0 ? "in" : "out",
    account: String(tx?.account.id ?? choices.account_options[0]?.id ?? ""),
    category: tx?.category ? String(tx.category.id) : "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = { preserveScroll: true, onSuccess: onClose };
    if (tx) form.put(`/money/transactions/${tx.id}/`, o);
    else form.post("/money/transactions/", o);
  };
  return (
    <Dialog open title={tx ? "Edit transaction" : "Add a transaction"} onClose={onClose}>
      {choices.account_options.length === 0 ? (
        <p>Add an account first. <a href="/money/accounts/" className="text-accent underline">Accounts</a></p>
      ) : (
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <FormError errors={form.errors as Record<string, string>} />
          <Segmented label="Direction" value={form.data.direction} onChange={(v) => form.setData("direction", v)}
            options={[{ value: "out", label: "Money out" }, { value: "in", label: "Money in" }]} />
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="Amount (R)" value={form.data.amount} onChange={(v) => form.setData("amount", v)} error={form.errors.amount} autoFocus />
            <Field label="Date" type="date" value={form.data.date} onChange={(v) => form.setData("date", v)} error={form.errors.date} />
          </div>
          <Field label="Description" value={form.data.description} onChange={(v) => form.setData("description", v)}
            error={form.errors.description} placeholder="e.g. Woolworths" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Account" value={form.data.account} onChange={(v) => form.setData("account", v)} error={form.errors.account}
              options={choices.account_options.map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Category" value={form.data.category} onChange={(v) => form.setData("category", v)} error={form.errors.category}
              placeholder="Uncategorised" options={choices.category_options.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            {tx ? <Button variant="ghost" onClick={() => { router.delete(`/money/transactions/${tx.id}/`, { preserveScroll: true }); onClose(); }}>
              Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={form.processing}>Save</Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** Upload a receipt photo. Uploads must be POST + multipart: Django parses files only for POST. */
export function ReceiptDialog({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const form = useForm<{ receipt: File | null }>({ receipt: null });
  return (
    <Dialog open title="Receipt" onClose={onClose}>
      {tx.receipt_id && (
        <div className="mb-4 grid gap-2">
          <img src={`/files/receipt/${tx.receipt_id}/`} alt={`Receipt for ${tx.description}`} className="max-h-[50vh] w-full object-contain" />
          <Button variant="ghost" size="sm" onClick={() => { router.delete(`/money/receipts/${tx.receipt_id}/`, { preserveScroll: true }); onClose(); }}>
            Remove receipt
          </Button>
        </div>
      )}
      <form className="grid gap-3" onSubmit={(e) => {
        e.preventDefault();
        form.post(`/money/transactions/${tx.id}/receipt/`, { forceFormData: true, preserveScroll: true, onSuccess: onClose });
      }}>
        <label className="text-[13px] font-semibold" htmlFor="receipt-file">{tx.receipt_id ? "Replace with" : "Photo of the receipt"}</label>
        <input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => form.setData("receipt", e.target.files?.[0] ?? null)} />
        <p className="text-[13px] text-muted">JPEG, PNG or WebP, up to 5 MB. Location data is removed. Only you can see it.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button type="submit" disabled={!form.data.receipt} loading={form.processing}>Upload</Button>
        </div>
      </form>
    </Dialog>
  );
}
