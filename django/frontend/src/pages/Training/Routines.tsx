import { Link, router } from "@inertiajs/react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type RoutineItem = { id?: number; exercise_id: number; exercise: string; target_sets: number; target_reps: number; rest_seconds: number };
export type Routine = { id: number; name: string; notes: string; items: RoutineItem[] };

export default function TrainingRoutines({ routines }: { routines: Routine[] }) {
  return (
    <>
      <PageHeader kicker="Training" title="Routines" actions={<ButtonLink href="/training/routines/new/" variant="primary">New routine</ButtonLink>} />
      <TrainingNav />
      {routines.length === 0 ? <EmptyState title="No routines yet." body="A routine is a list of exercises with target sets and reps. Workouts started from it come pre-filled with last time's weights."
        action={<ButtonLink href="/training/routines/new/" variant="primary">Make one</ButtonLink>} /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {routines.map((r) => (
            <li key={r.id} className="border border-line bg-surface p-5">
              <Link href={`/training/routines/${r.id}/`} className="font-serif text-2xl hover:underline">{r.name}</Link>
              <ol className="mt-2 grid gap-0.5 text-sm text-muted">
                {r.items.map((i) => <li key={i.id}>{i.exercise} <span className="num">· {i.target_sets}×{i.target_reps}</span></li>)}
              </ol>
              <Button size="sm" className="mt-4" onClick={() => router.post("/training/start/", { routine_id: r.id })}>Start workout</Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
