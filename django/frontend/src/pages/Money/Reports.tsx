import { router } from "@inertiajs/react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart, HBars } from "@/components/ui/BarChart";
import { Section, Stat } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { formatDayMonth, formatMonthShort } from "@/lib/dates";
import { formatSigned, formatZar } from "@/lib/money";

type Props = { months: 3 | 6 | 12; from: string; to: string; per_month: { month: string; spent_cents: number; earned_cents: number }[];
  per_category: { category: string; colour: string; spent_cents: number }[]; spent_cents: number; earned_cents: number;
  net_cents: number; average_spent_cents: number };

export default function MoneyReports(p: Props) {
  const rands = (c: number) => formatZar(c).replace(/,\d\d$/, "");
  return (
    <>
      <PageHeader kicker="Money" title="Reports" deck={`${formatDayMonth(p.from)} to ${formatDayMonth(p.to)} · transfers excluded`}
        actions={<Segmented label="Period" value={p.months} onChange={(m) => router.get("/money/reports/", { months: m }, { preserveState: true })}
          options={[{ value: 3, label: "3 months" }, { value: 6, label: "6 months" }, { value: 12, label: "12 months" }]} />} />
      <MoneyNav />
      <div className="mb-10 grid gap-6 sm:grid-cols-4">
        <Stat label="Spent" value={formatZar(p.spent_cents)} />
        <Stat label="Came in" value={formatZar(p.earned_cents)} />
        <Stat label="Net" value={formatSigned(p.net_cents)} />
        <Stat label="Average spend / month" value={formatZar(p.average_spent_cents)} />
      </div>
      <div className="grid gap-12 lg:grid-cols-2">
        <Section kicker="Spending per month">
          <BarChart caption="Spending per month" height={200}
            items={p.per_month.map((m, i) => ({ label: formatMonthShort(m.month), value: m.spent_cents, display: rands(m.spent_cents),
              highlight: i === p.per_month.length - 1 }))} />
        </Section>
        <Section kicker="By category">
          {p.per_category.length === 0 ? <p className="text-muted">No spending in this period.</p> :
            <HBars caption="Spending by category" items={p.per_category.map((c) => ({ label: c.category, value: c.spent_cents,
              display: formatZar(c.spent_cents), colour: c.colour }))} />}
        </Section>
      </div>
    </>
  );
}
