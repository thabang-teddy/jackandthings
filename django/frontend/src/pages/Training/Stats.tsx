import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section, Stat } from "@/components/ui/Section";
import { formatDayMonth, formatLongDay } from "@/lib/dates";
import { kg } from "@/lib/units";

type RecordRow = { exercise: string; e1rm_x10: number; kg_x10: number; reps: number; date: string };
type Day = { date: string; trained: boolean; future: boolean };

export default function TrainingStats({ records, consistency, streak_weeks, this_week }:
  { records: RecordRow[]; consistency: Day[]; streak_weeks: number; this_week: number }) {
  return (
    <>
      <PageHeader kicker="Training" title="Stats" />
      <TrainingNav />
      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <Stat label="Streak" value={`${streak_weeks} wk`} />
        <Stat label="This week" value={this_week} />
        <Stat label="Days trained (12 wk)" value={consistency.filter((d) => d.trained).length} />
      </div>
      <div className="grid gap-12 lg:grid-cols-2">
        <Section kicker="Consistency · 12 weeks"><Consistency days={consistency} /></Section>
        <Section kicker="Records" title={records.length ? undefined : "Log sets to see records."}>
          {records.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-text text-[12px] uppercase tracking-wider text-muted">
                <tr><th className="py-2">Exercise</th><th className="text-right">Best set</th><th className="text-right">Est. 1RM</th><th className="text-right">When</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {records.map((r) => (
                  <tr key={r.exercise}>
                    <td className="py-2.5">{r.exercise}</td>
                    <td className="num text-right">{kg(r.kg_x10)} × {r.reps}</td>
                    <td className="num text-right font-semibold">{kg(r.e1rm_x10)} kg</td>
                    <td className="text-right text-muted">{formatDayMonth(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] text-muted">Estimated one-rep max uses the Epley formula: kg × (1 + reps ÷ 30).</p>
        </Section>
      </div>
    </>
  );
}

/** Weeks as columns, Monday at the top — like a contribution graph, with a text alternative. */
export function Consistency({ days }: { days: Day[] }) {
  const weeks: Day[][] = [];
  days.forEach((d, i) => { (weeks[Math.floor(i / 7)] ??= []).push(d); });
  const trained = days.filter((d) => d.trained).length;
  return (
    <figure aria-label={`Trained on ${trained} of the last ${days.filter((d) => !d.future).length} days`}>
      <div className="flex gap-1" aria-hidden>
        {weeks.map((w, i) => (
          <div key={i} className="grid gap-1">
            {w.map((d) => <span key={d.date} title={formatLongDay(d.date)}
              className={`block size-3.5 ${d.future ? "bg-transparent" : d.trained ? "bg-accent" : "bg-line"}`} />)}
          </div>
        ))}
      </div>
    </figure>
  );
}
