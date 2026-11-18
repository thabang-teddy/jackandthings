import { router, useForm } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { chime } from "@/lib/sound";
import { formatMs, useElapsed, useSecondsUntil } from "@/lib/time";
import { kg } from "@/lib/units";
import type { Exercise } from "./Exercises";

type SetRow = { id: number; position: number; kg_x10: number; reps: number; rest_seconds: number; done: boolean; pr: boolean };
type Group = { exercise: Exercise; sets: SetRow[]; last_time: { kg_x10: number; reps: number }[] };
type Props = { session: { id: number; name: string; started_at: string; notes: string; rest_until: string | null };
  groups: Group[]; exercises: Exercise[]; server_now: string };
const opts = { preserveScroll: true };

export default function TrainingLive({ session, groups, exercises, server_now }: Props) {
  const elapsed = useElapsed(session.started_at, 0, null);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [adding, setAdding] = useState("");
  const done = groups.reduce((n, g) => n + g.sets.filter((s) => s.done).length, 0);
  return (
    <>
      <PageHeader kicker={`Live · ${formatMs(elapsed)}`} title={session.name} deck={`${done} set${done === 1 ? "" : "s"} done`}
        actions={<>
          <Button variant="live" onClick={() => setFinishing(true)}>Finish</Button>
          <Button variant="ghost" onClick={() => setDiscarding(true)}>Discard</Button>
        </>} />
      <RestTimer until={session.rest_until} serverNow={server_now} />
      <div className="grid gap-10">
        {groups.map((g) => <ExerciseBlock key={g.exercise.id} group={g} />)}
        {groups.length === 0 && <p className="text-muted">Add your first exercise below.</p>}
      </div>
      <div className="mt-10 flex max-w-md items-end gap-2">
        <Select label="Add an exercise" value={adding} onChange={setAdding} placeholder="Choose…" className="flex-1"
          options={exercises.map((e) => ({ value: e.id, label: e.name }))} />
        <Button disabled={!adding} onClick={() => { router.post("/training/live/sets/", { exercise_id: Number(adding) }, opts); setAdding(""); }}>Add</Button>
      </div>
      {finishing && <FinishDialog notes={session.notes} onClose={() => setFinishing(false)} />}
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} title="Discard this workout?"
        body="Nothing from this session will be saved." confirmLabel="Discard" onConfirm={() => router.post("/training/live/discard/")} />
    </>
  );
}

function ExerciseBlock({ group }: { group: Group }) {
  return (
    <section aria-label={group.exercise.name} className="rule pt-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">{group.exercise.name}</h2>
        <p className="text-[13px] text-muted">
          {group.last_time.length ? <>Last time: <span className="num">{group.last_time.map((s) => `${kg(s.kg_x10)}×${s.reps}`).join(", ")}</span></> : "First time — pick a comfortable weight."}
        </p>
      </div>
      <table className="w-full max-w-xl text-left text-sm">
        <thead className="text-[12px] uppercase tracking-wider text-muted">
          <tr><th className="w-12 py-1">Set</th><th>kg</th><th>Reps</th><th className="w-24"><span className="sr-only">Done</span></th><th className="w-10" /></tr>
        </thead>
        <tbody>{group.sets.map((s, i) => <SetLine key={s.id} set={s} n={i + 1} name={group.exercise.name} />)}</tbody>
      </table>
      <button className="mt-2 text-[13px] font-semibold text-muted underline"
        onClick={() => router.post("/training/live/sets/", { exercise_id: group.exercise.id }, opts)}>+ Add set</button>
    </section>
  );
}

function SetLine({ set, n, name }: { set: SetRow; n: number; name: string }) {
  const form = useForm({ kg: kg(set.kg_x10), reps: String(set.reps), done: set.done });
  useEffect(() => { form.setData({ kg: kg(set.kg_x10), reps: String(set.reps), done: set.done }); }, [set.kg_x10, set.reps, set.done]);
  const save = (done: boolean) => {
    form.transform((d) => ({ ...d, done }));
    form.put(`/training/live/sets/${set.id}/`, opts);
  };
  const cell = "h-10 w-20 rounded-[3px] border border-field bg-surface2 px-2 num";
  return (
    <tr className={set.done ? "bg-pos-tint/50" : ""}>
      <td className="num py-1.5 text-muted">{n}</td>
      <td><input aria-label={`${name} set ${n} kg`} inputMode="decimal" className={cell} value={form.data.kg}
        onChange={(e) => form.setData("kg", e.target.value)} onBlur={() => form.isDirty && save(form.data.done)} aria-invalid={!!form.errors.kg} /></td>
      <td><input aria-label={`${name} set ${n} reps`} inputMode="numeric" className={cell} value={form.data.reps}
        onChange={(e) => form.setData("reps", e.target.value)} onBlur={() => form.isDirty && save(form.data.done)} aria-invalid={!!form.errors.reps} /></td>
      <td>
        <button aria-pressed={set.done} onClick={() => save(!set.done)}
          className={`h-10 w-20 rounded-[3px] text-sm font-semibold ${set.done ? "bg-pos text-bg" : "border border-text"}`}>
          {set.done ? "Done ✓" : "Log"}
        </button>
        {set.pr && <span className="ml-2"><Badge tone="live">PR</Badge></span>}
      </td>
      <td><button aria-label={`Remove ${name} set ${n}`} className="px-2 text-lg text-muted hover:text-neg"
        onClick={() => router.delete(`/training/live/sets/${set.id}/`, opts)}>×</button></td>
    </tr>
  );
}

function RestTimer({ until, serverNow }: { until: string | null; serverNow: string }) {
  const left = useSecondsUntil(until, serverNow);
  const rang = useRef<string | null>(null);
  useEffect(() => {
    if (until && left === 0 && rang.current !== until) {
      rang.current = until;
      chime("soft");
    }
  }, [left, until]);
  if (!until || left === 0) return null;
  return (
    <div role="timer" aria-label="Rest" className="sticky top-0 z-20 mb-8 flex items-center gap-4 border-l-[3px] border-live bg-live-tint px-4 py-3">
      <span className="kicker">Rest</span>
      <span className="num font-serif text-4xl">{formatMs(left)}</span>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => router.post("/training/live/rest/skip/", {}, opts)}>Skip rest</Button>
    </div>
  );
}

function FinishDialog({ notes, onClose }: { notes: string; onClose: () => void }) {
  const form = useForm({ notes });
  return (
    <Dialog open title="Finish workout" onClose={onClose}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); form.post("/training/live/finish/"); }}>
        <p className="text-sm text-muted">Sets you didn't log are removed.</p>
        <TextArea label="Notes" rows={3} value={form.data.notes} onChange={(v) => form.setData("notes", v)} placeholder="How did it feel?" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Keep going</Button>
          <Button type="submit" variant="live" loading={form.processing}>Save workout</Button>
        </div>
      </form>
    </Dialog>
  );
}
