import { Link, router } from "@inertiajs/react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Section, Stat } from "@/components/ui/Section";
import { formatDayMonth } from "@/lib/dates";
import { Consistency } from "./Stats";
import type { Routine } from "./Routines";
import type { SessionSummary } from "./Sessions";

type Props = { live: { id: number; name: string; started_at: string } | null; routines: Routine[]; recent: SessionSummary[];
  streak_weeks: number; this_week: number; consistency: { date: string; trained: boolean; future: boolean }[] };

export default function TrainingIndex(p: Props) {
  return (
    <>
      <PageHeader kicker="Training" title={p.live ? "Workout in progress" : "Train"}
        actions={p.live ? <ButtonLink href="/training/live/" variant="live">Back to {p.live.name}</ButtonLink>
          : <Button onClick={() => router.post("/training/start/", {})}>Empty workout</Button>} />
      <TrainingNav />
      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <Stat label="Streak" value={`${p.streak_weeks} week${p.streak_weeks === 1 ? "" : "s"}`} />
        <Stat label="This week" value={`${p.this_week} session${p.this_week === 1 ? "" : "s"}`} />
        <div><p className="kicker mb-2">Last 6 weeks</p><Consistency days={p.consistency} /></div>
      </div>
      <div className="grid gap-12 lg:grid-cols-2">
        <Section kicker="Start from a routine" action={<Link href="/training/routines/new/" className="text-sm font-semibold underline">New routine</Link>}>
          {p.routines.length === 0 ? <p className="text-muted">Make a routine (e.g. Push day) so each workout starts pre-filled.</p> : (
            <ul className="divide-y divide-line border-y border-line">
              {p.routines.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1"><p className="font-semibold">{r.name}</p>
                    <p className="text-[13px] text-muted">{r.items.map((i) => i.exercise).join(" · ")}</p></div>
                  <Button size="sm" disabled={!!p.live} onClick={() => router.post("/training/start/", { routine_id: r.id })}>Start</Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section kicker="Recent" action={<Link href="/training/sessions/" className="text-sm font-semibold underline">History</Link>}>
          {p.recent.length === 0 ? <p className="text-muted">No workouts yet.</p> : (
            <ul className="grid gap-4">
              {p.recent.map((s) => (
                <li key={s.id}><p className="font-semibold">{s.name} <span className="font-normal text-muted">· {formatDayMonth(s.date)}</span></p>
                  <p className="num text-[13px] text-muted">{s.sets} sets · {s.volume_kg.toLocaleString("en-ZA")} kg · {s.minutes} min</p></li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
