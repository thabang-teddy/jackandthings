import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { AmountField, Field } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Meter";
import { formatDayMonth } from "@/lib/dates";
import { centsToInput, formatZar } from "@/lib/money";
import type { Goal } from "./Overview";

export default function MoneyGoals({ goals, today, editing }: { goals: Goal[]; today: string; editing: number | null }) {
  const [open, setOpen] = useState<Goal | "new" | null>(null);
  const [adding, setAdding] = useState<Goal | null>(editing ? goals.find((g) => g.id === editing) ?? null : null);
  const [removing, setRemoving] = useState<Goal | null>(null);
  return (
    <>
      <PageHeader kicker="Money" title="Goals" actions={<Button onClick={() => setOpen("new")}>New goal</Button>} />
      <MoneyNav />
      {goals.length === 0 ? <EmptyState title="No goals yet." body="A holiday, an emergency fund, a new laptop. Set a target and a date; we'll tell you the monthly amount."
        action={<Button onClick={() => setOpen("new")}>Make a goal</Button>} /> : (
        <ul className="grid gap-6 md:grid-cols-2">
          {goals.map((g) => (
            <li key={g.id} className="grid gap-3 border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-2xl">{g.name} {g.done && <Badge tone="pos">Reached</Badge>}</p>
                  {g.target_date && <p className="text-[13px] text-muted">By {formatDayMonth(g.target_date)}</p>}
                </div>
                <p className="num text-right"><b className="font-serif text-2xl">{formatZar(g.saved_cents)}</b><br />
                  <span className="text-[13px] text-muted">of {formatZar(g.target_cents)}</span></p>
              </div>
              <Progress value={g.saved_cents} max={g.target_cents} label={`${g.name}: ${g.pct}%`} />
              <p className="text-sm">{g.done ? "Done. Well saved." : g.monthly_cents
                ? <>Put away <b className="num">{formatZar(g.monthly_cents)}</b> a month to get there.</>
                : <>{formatZar(g.remaining_cents)} to go.</>}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAdding(g)}>Add money</Button>
                <Button size="sm" variant="secondary" onClick={() => setOpen(g)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(g)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <GoalDialog goal={open === "new" ? null : open} onClose={() => setOpen(null)} />}
      {adding && <ContributeDialog goal={adding} today={today} onClose={() => setAdding(null)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.name}?`}
        body="The goal and its contributions are removed. Your accounts don't change." confirmLabel="Delete goal"
        onConfirm={() => removing && router.delete(`/money/goals/${removing.id}/`)} />
    </>
  );
}

function GoalDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const form = useForm({ name: goal?.name ?? "", target: goal ? centsToInput(goal.target_cents) : "", target_date: goal?.target_date ?? "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal) form.put(`/money/goals/${goal.id}/`, { onSuccess: onClose });
    else form.post("/money/goals/", { onSuccess: onClose });
  };
  return (
    <Dialog open title={goal ? "Edit goal" : "New goal"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus />
        <AmountField label="Target (R)" value={form.data.target} onChange={(v) => form.setData("target", v)} error={form.errors.target} />
        <Field label="Target date" type="date" value={form.data.target_date} onChange={(v) => form.setData("target_date", v)}
          error={form.errors.target_date} hint="Optional. With a date we work out the monthly amount." />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ContributeDialog({ goal, today, onClose }: { goal: Goal; today: string; onClose: () => void }) {
  const form = useForm({ amount: goal.monthly_cents ? centsToInput(goal.monthly_cents) : "", date: today });
  return (
    <Dialog open title={`Add to ${goal.name}`} onClose={onClose}>
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post(`/money/goals/${goal.id}/contribute/`, { onSuccess: onClose }); }}>
        <FormError errors={form.errors as Record<string, string>} />
        <AmountField label="Amount (R)" value={form.data.amount} onChange={(v) => form.setData("amount", v)} error={form.errors.amount}
          hint="Use a minus to take money back out, e.g. -500." autoFocus />
        <Field label="Date" type="date" value={form.data.date} onChange={(v) => form.setData("date", v)} error={form.errors.date} />
        <p className="text-[13px] text-muted">This records progress only. To actually move money, use Move money.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}
