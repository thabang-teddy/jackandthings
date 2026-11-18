import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { AmountField, Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { centsToInput, formatZar } from "@/lib/money";
import type { Option } from "@/lib/types";
import type { Account } from "./Overview";

export default function MoneyAccounts({ accounts, kinds, editing }: { accounts: Account[]; kinds: Option[]; editing: number | null }) {
  const [open, setOpen] = useState<Account | "new" | null>(editing ? accounts.find((a) => a.id === editing) ?? null : null);
  const [removing, setRemoving] = useState<Account | null>(null);
  return (
    <>
      <PageHeader kicker="Money" title="Accounts" actions={<Button onClick={() => setOpen("new")}>Add account</Button>} />
      <MoneyNav />
      {accounts.length === 0 ? <p className="text-muted">No accounts yet. Add the one you use most.</p> : (
        <ul className="divide-y divide-line border-y border-line">
          {accounts.map((a) => (
            <li key={a.id} className={`flex flex-wrap items-center gap-4 py-4 ${a.archived ? "opacity-60" : ""}`}>
              <div className="flex-1">
                <p className="font-semibold">{a.name} {a.archived && <Badge>Archived</Badge>}</p>
                <p className="text-[13px] text-muted">{kinds.find((k) => k.value === a.kind)?.label} · opened with {formatZar(a.opening_cents)}</p>
              </div>
              <span className={`num font-serif text-2xl ${a.balance_cents < 0 ? "text-neg" : ""}`}>{formatZar(a.balance_cents)}</span>
              <Button size="sm" variant="secondary" onClick={() => setOpen(a)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(a)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
      {open && <AccountDialog account={open === "new" ? null : open} kinds={kinds} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.name}?`}
        body="An account with transactions is archived instead, so your history stays correct." confirmLabel="Delete"
        onConfirm={() => removing && router.delete(`/money/accounts/${removing.id}/`)} />
    </>
  );
}

function AccountDialog({ account, kinds, onClose }: { account: Account | null; kinds: Option[]; onClose: () => void }) {
  const form = useForm({ name: account?.name ?? "", kind: account?.kind ?? "cheque",
    opening: account ? (account.opening_cents < 0 ? "-" : "") + centsToInput(account.opening_cents) : "",
    archived: account?.archived ?? false });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = { onSuccess: onClose };
    if (account) form.put(`/money/accounts/${account.id}/`, o);
    else form.post("/money/accounts/", o);
  };
  return (
    <Dialog open title={account ? "Edit account" : "Add an account"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus placeholder="e.g. FNB Cheque" />
        <Select label="Type" value={form.data.kind} onChange={(v) => form.setData("kind", v)} options={kinds} />
        <AmountField label="Balance when you started (R)" value={form.data.opening} onChange={(v) => form.setData("opening", v)}
          error={form.errors.opening} hint="Negative for a credit card you owe on, e.g. -1 200,00." />
        {account && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.archived}
          onChange={(e) => form.setData("archived", e.target.checked)} /> Archived (hidden from forms)</label>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
