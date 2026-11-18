import { Link, router } from "@inertiajs/react";
import { ProjectsNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart, HBars } from "@/components/ui/BarChart";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section, Stat } from "@/components/ui/Section";
import { formatDayMonth, formatTime, formatWeekday, todayIso } from "@/lib/dates";
import { formatDuration, formatHms, useElapsed } from "@/lib/time";

type Row = { id: number; card_id: number; card: string; project: string; colour: string; started_at: string;
  stopped_at: string | null; seconds: number; running: boolean; local_date: string };
type Running = Row & { paused_at: string | null; paused_seconds: number };
type Props = { week: string; prev_week: string; next_week: string; week_start: string; entries: Row[];
  per_day: { date: string; seconds: number }[]; per_project: { name: string; colour: string; seconds: number }[];
  total_seconds: number; running: Running | null; server_now: string };

export default function ProjectTime(p: Props) {
  const today = todayIso();
  return (
    <>
      <PageHeader kicker="Projects" title="Time" deck={`Week of ${formatDayMonth(p.week_start)}`} actions={<>
        <Button variant="secondary" onClick={() => router.get("/projects/time/", { week: p.prev_week })} aria-label="Previous week">←</Button>
        <Button variant="secondary" onClick={() => router.get("/projects/time/", { week: p.next_week })} aria-label="Next week">→</Button>
        <a href="/projects/time.csv" className="inline-flex h-10 items-center border border-text px-4 text-sm font-semibold hover:bg-tint">Export CSV</a>
      </>} />
      <ProjectsNav />
      {p.running && <RunningBar r={p.running} />}
      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <Stat label="This week" value={formatDuration(p.total_seconds)} />
        <Stat label="Projects" value={p.per_project.length} />
        <Stat label="Entries" value={p.entries.length} />
      </div>
      <div className="mb-12 grid gap-10 lg:grid-cols-2">
        <Section kicker="Per day">
          <BarChart caption="Hours tracked per day this week"
            items={p.per_day.map((d) => ({ label: formatWeekday(d.date), value: d.seconds, display: formatDuration(d.seconds), highlight: d.date === today }))} />
        </Section>
        <Section kicker="Per project">
          {p.per_project.length ? <HBars caption="Time tracked per project this week"
            items={p.per_project.map((x) => ({ label: x.name, value: x.seconds, display: formatDuration(x.seconds), colour: x.colour }))} />
            : <p className="text-muted">No time this week.</p>}
        </Section>
      </div>
      <Section kicker="Entries">
        {p.entries.length === 0 ? <EmptyState title="Nothing tracked this week." body="Open a card and press Start timer." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b-2 border-text text-[12px] uppercase tracking-wider text-muted">
                <tr><th className="py-2">Day</th><th>Start</th><th>Stop</th><th>Card</th><th>Project</th><th className="text-right">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5">{formatWeekday(e.local_date)} {formatDayMonth(e.local_date)}</td>
                    <td className="num">{formatTime(e.started_at)}</td>
                    <td className="num">{e.stopped_at ? formatTime(e.stopped_at) : <span className="font-semibold text-live-ink">running</span>}</td>
                    <td><Link href={`/projects/cards/${e.card_id}/`} className="underline">{e.card}</Link></td>
                    <td><span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2 rounded-full" style={{ background: e.colour }} />{e.project}</span></td>
                    <td className="num text-right">{formatDuration(e.seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function RunningBar({ r }: { r: Running }) {
  const secs = useElapsed(r.started_at, r.paused_seconds, r.paused_at);
  return (
    <div className="mb-8 flex flex-wrap items-center gap-4 border-l-[3px] border-live bg-live-tint px-4 py-3">
      <i aria-hidden className="size-2.5 rounded-full bg-live" />
      <span className="flex-1"><b>{r.card}</b> · {r.project}</span>
      <span className="num font-serif text-2xl">{formatHms(secs)}</span>
      <Button size="sm" onClick={() => router.post("/projects/timer/stop/", {}, { preserveScroll: true })}>Stop</Button>
    </div>
  );
}
