import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import type { Exercise } from "./Exercises";
import type { Routine, RoutineItem } from "./Routines";

export default function RoutineEdit({ routine, exercises }: { routine: Routine | null; exercises: Exercise[] }) {
  const form = useForm<{ name: string; notes: string; items: RoutineItem[] }>({
    name: routine?.name ?? "", notes: routine?.notes ?? "", items: routine?.items ?? [] });
  const [adding, setAdding] = useState("");
  const [deleting, setDeleting] = useState(false);
  const items = form.data.items;
  const setItems = (next: RoutineItem[]) => form.setData("items", next);
  const update = (i: number, patch: Partial<RoutineItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const moveItem = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const add = () => {
    const ex = exercises.find((e) => String(e.id) === adding);
    if (!ex) return;
    setItems([...items, { exercise_id: ex.id, exercise: ex.name, target_sets: 3, target_reps: 8, rest_seconds: 90 }]);
    setAdding("");
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (routine) form.put(`/training/routines/${routine.id}/`);
    else form.post("/training/routines/");
  };
  const num = "h-10 w-16 rounded-[3px] border border-field bg-surface2 px-2 num";
  return (
    <>
      <PageHeader kicker="Training" title={routine ? routine.name : "New routine"}
        actions={routine && <Button variant="ghost" onClick={() => setDeleting(true)}>Delete routine</Button>} />
      <TrainingNav />
      <form className="grid max-w-3xl gap-6" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} placeholder="e.g. Push day" />
        <TextArea label="Notes" rows={2} value={form.data.notes} onChange={(v) => form.setData("notes", v)} />
        <div>
          <p className="mb-2 text-[13px] font-semibold">Exercises</p>
          {form.errors.items && <Alert tone="error">{form.errors.items}</Alert>}
          {items.length === 0 ? <p className="text-sm text-muted">No exercises yet.</p> : (
            <ol className="divide-y divide-line border-y border-line">
              {items.map((it, i) => (
                <li key={`${it.exercise_id}-${i}`} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="num w-6 text-muted">{i + 1}</span>
                  <span className="min-w-[160px] flex-1 font-medium">{it.exercise}</span>
                  <label className="flex items-center gap-1 text-[13px]">Sets
                    <input className={num} inputMode="numeric" value={it.target_sets} onChange={(e) => update(i, { target_sets: Number(e.target.value) || 1 })} /></label>
                  <label className="flex items-center gap-1 text-[13px]">Reps
                    <input className={num} inputMode="numeric" value={it.target_reps} onChange={(e) => update(i, { target_reps: Number(e.target.value) || 1 })} /></label>
                  <label className="flex items-center gap-1 text-[13px]">Rest (s)
                    <input className={num} inputMode="numeric" value={it.rest_seconds} onChange={(e) => update(i, { rest_seconds: Number(e.target.value) || 0 })} /></label>
                  <span className="flex">
                    <button type="button" aria-label={`Move ${it.exercise} up`} className="px-2" onClick={() => moveItem(i, -1)}>↑</button>
                    <button type="button" aria-label={`Move ${it.exercise} down`} className="px-2" onClick={() => moveItem(i, 1)}>↓</button>
                    <button type="button" aria-label={`Remove ${it.exercise}`} className="px-2 text-muted hover:text-neg"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex max-w-md items-end gap-2">
            <Select label="Add exercise" hideLabel value={adding} onChange={setAdding} placeholder="Add an exercise…" className="flex-1"
              options={exercises.map((e) => ({ value: e.id, label: e.name }))} />
            <Button variant="secondary" onClick={add} disabled={!adding}>Add</Button>
          </div>
        </div>
        <div><Button type="submit" loading={form.processing}>Save routine</Button></div>
      </form>
      {routine && <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title={`Delete ${routine.name}?`}
        body="Past workouts stay in your history." confirmLabel="Delete routine" onConfirm={() => router.delete(`/training/routines/${routine.id}/`)} />}
    </>
  );
}
