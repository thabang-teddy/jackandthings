import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { FocusNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { Preset } from "./Timer";

const AUTO = [{ value: "off", label: "Off" }, { value: "breaks", label: "Start breaks automatically" },
  { value: "focus", label: "Start focus automatically" }, { value: "both", label: "Start both automatically" }];
const SOUNDS = [{ value: "bell", label: "Bell" }, { value: "soft", label: "Soft" }, { value: "none", label: "None" }];

export default function FocusPresets({ presets, editing }: { presets: Preset[]; editing?: number }) {
  const [open, setOpen] = useState<Preset | "new" | null>(editing ? presets.find((p) => p.id === editing) ?? null : null);
  const [deleting, setDeleting] = useState<Preset | null>(null);
  return (
    <>
      <PageHeader kicker="Focus" title="Presets" actions={<Button onClick={() => setOpen("new")}>New preset</Button>} />
      <FocusNav />
      <ul className="divide-y divide-line border-y border-line">
        {presets.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex-1">
              <p className="font-semibold">{p.name} {p.is_default && <Badge>Default</Badge>} {p.strict && <Badge tone="warn">Strict</Badge>}</p>
              <p className="num text-sm text-muted">
                {p.focus_min} min focus · {p.short_min} short · {p.long_min} long every {p.long_every}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setOpen(p)}>Edit</Button>
            {presets.length > 1 && <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>Delete</Button>}
          </li>
        ))}
      </ul>
      {open && <PresetDialog preset={open === "new" ? null : open} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete this preset?"
        body="Past sessions keep their history." confirmLabel="Delete preset"
        onConfirm={() => deleting && router.delete(`/focus/presets/${deleting.id}/`)} />
    </>
  );
}

function PresetDialog({ preset, onClose }: { preset: Preset | null; onClose: () => void }) {
  const form = useForm({
    name: preset?.name ?? "", focus_min: String(preset?.focus_min ?? 25), short_min: String(preset?.short_min ?? 5),
    long_min: String(preset?.long_min ?? 15), long_every: String(preset?.long_every ?? 4),
    auto_start: preset?.auto_start ?? "off", sound: preset?.sound ?? "bell", strict: preset?.strict ?? false,
    is_default: preset?.is_default ?? false,
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = { onSuccess: onClose, preserveScroll: true };
    if (preset) form.put(`/focus/presets/${preset.id}/`, o);
    else form.post("/focus/presets/", o);
  };
  const num = (k: "focus_min" | "short_min" | "long_min" | "long_every", label: string) => (
    <Field label={label} type="number" inputMode="numeric" min={1} value={form.data[k]} onChange={(v) => form.setData(k, v)} error={form.errors[k]} />
  );
  return (
    <Dialog open title={preset ? "Edit preset" : "New preset"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          {num("focus_min", "Focus (min)")}{num("short_min", "Short break (min)")}
          {num("long_min", "Long break (min)")}{num("long_every", "Long break every")}
        </div>
        <Select label="Auto-start" value={form.data.auto_start} options={AUTO}
          onChange={(v) => form.setData("auto_start", v as Preset["auto_start"])} />
        <Select label="Sound" value={form.data.sound} options={SOUNDS} onChange={(v) => form.setData("sound", v)} />
        <Checkbox label="Strict mode" hint="This tab stays awake and asks before you leave. Blocking sites is the extension's job."
          checked={form.data.strict} onChange={(v) => form.setData("strict", v)} />
        <Checkbox label="Make this the default" checked={form.data.is_default} onChange={(v) => form.setData("is_default", v)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save preset</Button>
        </div>
      </form>
    </Dialog>
  );
}
