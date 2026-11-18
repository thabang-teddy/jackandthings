import { router } from "@inertiajs/react";
import { FocusNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart, HBars } from "@/components/ui/BarChart";
import { Section, Stat } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { formatDayMonth, formatWeekday } from "@/lib/dates";

type Props = { days: 7 | 30; per_day: { date: string; minutes: number }[]; total_minutes: number; average_minutes: number;
  streak: string; by_tag: { tag: string; minutes: number }[] };

export default function FocusStats(p: Props) {
  return (
    <>
      <PageHeader kicker="Focus" title="Stats" actions={
        <Segmented label="Range" value={p.days} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }]}
          onChange={(d) => router.get("/focus/stats/", { days: d }, { preserveState: true })} />} />
      <FocusNav />
      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <Stat label="Total" value={`${p.total_minutes} min`} />
        <Stat label="Daily average" value={`${p.average_minutes} min`} />
        <Stat label="Active days" value={p.streak} />
      </div>
      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <Section kicker="Minutes per day">
          <BarChart caption={`Focus minutes per day, last ${p.days} days`}
            items={p.per_day.map((d) => ({ label: p.days === 7 ? formatWeekday(d.date) : formatDayMonth(d.date).split(" ")[0],
              value: d.minutes, display: `${d.minutes}` }))} />
        </Section>
        <Section kicker="By tag">
          {p.by_tag.length ? <HBars caption="Focus minutes by tag" items={p.by_tag.map((t) => ({ label: t.tag, value: t.minutes, display: `${t.minutes} min` }))} />
            : <p className="text-muted">Tag your sessions to see where the time goes.</p>}
        </Section>
      </div>
    </>
  );
}
