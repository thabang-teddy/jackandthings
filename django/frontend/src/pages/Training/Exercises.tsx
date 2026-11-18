import { router, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import type { Option } from "@/lib/types";

export type Exercise = { id: number; name: string; muscle: string; equipment: string; custom: boolean };

export default function TrainingExercises({ exercises, muscles, equipment }: { exercises: Exercise[]; muscles: Option[]; equipment: Option[] }) {
  const [muscle, setMuscle] = useState("");
  const [q, setQ] = useState("");
  const shown = useMemo(() => exercises.filter((e) => (!muscle || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase())),
    [exercises, muscle, q]);
  const form = useForm({ name: "", muscle: muscles[0]?.value ?? "legs", equipment: equipment[0]?.value ?? "barbell" });
  const label = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
  return (
    <>
      <PageHeader kicker="Training" title="Exercises" />
      <TrainingNav />
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 max-w-sm"><Field label="Search exercises" hideLabel type="search" placeholder="Search" value={q} onChange={setQ} /></div>
          <div className="mb-5 flex flex-wrap gap-2">
            <Chip selected={!muscle} onClick={() => setMuscle("")}>All</Chip>
            {muscles.map((m) => <Chip key={m.value} selected={muscle === m.value} onClick={() => setMuscle(m.value)}>{m.label}</Chip>)}
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="flex-1 font-medium">{e.name} {e.custom && <Badge>Yours</Badge>}</span>
                <span className="text-[13px] text-muted">{label(muscles, e.muscle)} · {label(equipment, e.equipment)}</span>
                {e.custom && <button className="text-[12px] text-muted underline" onClick={() => router.delete(`/training/exercises/${e.id}/`, { preserveScroll: true })}>Delete</button>}
              </li>
            ))}
          </ul>
        </div>
        <Section kicker="Add your own">
          <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/training/exercises/", { preserveScroll: true, onSuccess: () => form.reset("name") }); }}>
            <FormError errors={form.errors as Record<string, string>} />
            <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} />
            <Select label="Muscle group" value={form.data.muscle} onChange={(v) => form.setData("muscle", v)} options={muscles} />
            <Select label="Equipment" value={form.data.equipment} onChange={(v) => form.setData("equipment", v)} options={equipment} />
            <Button type="submit" loading={form.processing}>Add exercise</Button>
          </form>
        </Section>
      </div>
    </>
  );
}
