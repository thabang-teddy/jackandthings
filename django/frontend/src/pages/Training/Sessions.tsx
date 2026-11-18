import { router } from "@inertiajs/react";
import { useState } from "react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { formatLongDay } from "@/lib/dates";
import type { Paged } from "@/lib/types";
import { kg } from "@/lib/units";

export type SessionSummary = { id: number; name: string; date: string; started_at: string; minutes: number; sets: number;
  volume_kg: number; exercises: string[]; notes: string; detail: { exercise: string; kg_x10: number; reps: number }[] };

export default function TrainingSessions({ items, page, pages, total }: Paged<SessionSummary>) {
  const [removing, setRemoving] = useState<SessionSummary | null>(null);
  return (
    <>
      <PageHeader kicker="Training" title="History" />
      <TrainingNav />
      {items.length === 0 ? <EmptyState title="No workouts yet." /> : (
        <ul className="grid gap-4">
          {items.map((s) => (
            <li key={s.id}>
              <details className="border border-line bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-serif text-xl">{s.name}</span>
                  <span className="text-sm text-muted">{formatLongDay(s.date)}</span>
                  <span className="num ml-auto text-sm text-muted">{s.sets} sets · {s.volume_kg.toLocaleString("en-ZA")} kg · {s.minutes} min</span>
                </summary>
                <table className="mt-4 w-full max-w-md text-sm">
                  <tbody className="divide-y divide-line">
                    {s.detail.map((d, i) => <tr key={i}><td className="py-1.5">{d.exercise}</td><td className="num text-right">{kg(d.kg_x10)} kg × {d.reps}</td></tr>)}
                  </tbody>
                </table>
                {s.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{s.notes}</p>}
                <button className="mt-3 text-[13px] text-muted underline" onClick={() => setRemoving(s)}>Delete workout</button>
              </details>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pages={pages} total={total} noun="workouts" />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Delete this workout?"
        body="Its sets no longer count towards records." confirmLabel="Delete"
        onConfirm={() => removing && router.delete(`/training/sessions/${removing.id}/`, { preserveScroll: true })} />
    </>
  );
}
