import { router, useForm } from "@inertiajs/react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AmountField, Field } from "@/components/ui/Field";
import { Meter } from "@/components/ui/Meter";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import type { MoneyChoices } from "@/components/money/TransactionDialog";
import { formatMonthYear } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import type { CapRow } from "./Overview";

export default function MoneyCaps({ caps, category_options, month }: MoneyChoices & { caps: CapRow[]; month: string }) {
  const form = useForm({ category: String(category_options[0]?.id ?? ""), amount: "", warn_at_pct: "90" });
  const existing = caps.find((c) => String(c.category_id) === form.data.category);
  return (
    <>
      <PageHeader kicker="Money" title="Caps" deck={`Monthly limits per category · ${formatMonthYear(month)}. The blue tick is how far through the month we are.`} />
      <MoneyNav />
      <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
        <Section kicker="This month">
          {caps.length === 0 ? <p className="text-muted">No caps yet.</p> : (
            <ul className="grid gap-6">
              {caps.map((c) => (
                <li key={c.id} className="grid gap-1">
                  <Meter label={c.category} spent={c.spent_cents} cap={c.cap_cents} pace={c.pace} warn={c.warn} />
                  <p className="flex justify-between text-[12px] text-muted">
                    <span>{c.pct}% used · warns at {c.warn_at_pct}%</span>
                    <button className="underline" onClick={() => router.delete(`/money/caps/${c.id}/`, { preserveScroll: true })}>Remove cap</button>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section kicker={existing ? "Change a cap" : "Set a cap"}>
          <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/money/caps/", { preserveScroll: true, onSuccess: () => form.reset("amount") }); }}>
            <FormError errors={form.errors as Record<string, string>} />
            <Select label="Category" value={form.data.category} onChange={(v) => form.setData("category", v)} error={form.errors.category}
              options={category_options.map((c) => ({ value: c.id, label: c.name }))} />
            <AmountField label="Monthly limit (R)" value={form.data.amount} onChange={(v) => form.setData("amount", v)} error={form.errors.amount}
              placeholder={existing ? centsToInput(existing.cap_cents) : "0,00"} />
            <Field label="Warn at (%)" type="number" min={50} max={100} value={form.data.warn_at_pct} onChange={(v) => form.setData("warn_at_pct", v)} error={form.errors.warn_at_pct} />
            <Button type="submit" loading={form.processing}>{existing ? "Update cap" : "Save cap"}</Button>
          </form>
        </Section>
      </div>
    </>
  );
}
