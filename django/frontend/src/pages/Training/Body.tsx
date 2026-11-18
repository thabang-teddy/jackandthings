import { router, useForm } from "@inertiajs/react";
import { useEffect } from "react";
import { TrainingNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { formatDayMonth } from "@/lib/dates";
import { bodyKg, cm } from "@/lib/units";

type Entry = { id: number; date: string; weight_g: number | null; waist_mm: number | null; chest_mm: number | null; hips_mm: number | null; note: string };
type Photo = { id: number; date: string; url: string };
type Props = { entries: Entry[]; photo_count: number; today: string; photos?: Photo[] };

export default function TrainingBody({ entries, photo_count, today, photos }: Props) {
  const form = useForm({ date: today, weight: "", waist: "", chest: "", hips: "", note: "" });
  return (
    <>
      <PageHeader kicker="Training" title="Body" />
      <TrainingNav />
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <Section kicker="Measurements">
          {entries.length === 0 ? <p className="text-muted">No measurements yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b-2 border-text text-[12px] uppercase tracking-wider text-muted">
                  <tr><th className="py-2">Date</th><th className="text-right">kg</th><th className="text-right">Waist cm</th>
                    <th className="text-right">Chest cm</th><th className="text-right">Hips cm</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5">{formatDayMonth(e.date)}{e.note && <span className="block text-[12px] text-muted">{e.note}</span>}</td>
                      <td className="num text-right">{bodyKg(e.weight_g)}</td><td className="num text-right">{cm(e.waist_mm)}</td>
                      <td className="num text-right">{cm(e.chest_mm)}</td><td className="num text-right">{cm(e.hips_mm)}</td>
                      <td className="text-right"><button className="text-[12px] text-muted underline"
                        onClick={() => router.delete(`/training/body/${e.id}/`, { preserveScroll: true })}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section kicker="Add measurements">
          <form className="grid gap-3" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/training/body/", { preserveScroll: true, onSuccess: () => form.reset("weight", "waist", "chest", "hips", "note") }); }}>
            <FormError errors={form.errors as Record<string, string>} />
            <Field label="Date" type="date" value={form.data.date} onChange={(v) => form.setData("date", v)} error={form.errors.date} />
            <Field label="Weight (kg)" inputMode="decimal" value={form.data.weight} onChange={(v) => form.setData("weight", v)} error={form.errors.weight} placeholder="82,4" />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Waist (cm)" inputMode="decimal" value={form.data.waist} onChange={(v) => form.setData("waist", v)} error={form.errors.waist} />
              <Field label="Chest (cm)" inputMode="decimal" value={form.data.chest} onChange={(v) => form.setData("chest", v)} error={form.errors.chest} />
              <Field label="Hips (cm)" inputMode="decimal" value={form.data.hips} onChange={(v) => form.setData("hips", v)} error={form.errors.hips} />
            </div>
            <Field label="Note" value={form.data.note} onChange={(v) => form.setData("note", v)} />
            <Button type="submit" loading={form.processing}>Save</Button>
          </form>
        </Section>
      </div>
      <Photos photos={photos} count={photo_count} today={today} />
    </>
  );
}

/** Photos load only after "Show photos", and hide again when the tab is hidden. */
function Photos({ photos, count, today }: { photos?: Photo[]; count: number; today: string }) {
  const upload = useForm<{ photo: File | null; date: string }>({ photo: null, date: today });
  const shown = photos !== undefined;
  useEffect(() => {
    if (!shown) return;
    const hide = () => { if (document.visibilityState === "hidden") router.get("/training/body/", {}, { preserveScroll: true, replace: true }); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [shown]);
  return (
    <Section kicker={`Progress photos · ${count}`} className="mt-12" action={shown
      ? <Button size="sm" variant="secondary" onClick={() => router.get("/training/body/", {}, { preserveScroll: true, replace: true })}>Hide photos</Button>
      : count > 0 && <Button size="sm" variant="secondary" onClick={() => router.get("/training/body/photos/", {}, { preserveScroll: true, replace: true })}>Show photos</Button>}>
      <p className="mb-4 text-[13px] text-muted">Private: stored outside the website, never cached, location data removed.</p>
      {shown && (photos.length === 0 ? <p className="text-muted">No photos.</p> : (
        <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="grid gap-1">
              <img src={p.url} alt={`Progress photo, ${formatDayMonth(p.date)}`} className="aspect-[3/4] w-full object-cover" />
              <p className="flex justify-between text-[12px] text-muted">{formatDayMonth(p.date)}
                <button className="underline" onClick={() => router.delete(`/training/body/photos/${p.id}/`, { preserveScroll: true })}>Delete</button></p>
            </li>
          ))}
        </ul>
      ))}
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
        e.preventDefault();
        upload.post("/training/body/photos/upload/", { forceFormData: true, preserveScroll: true, onSuccess: () => upload.reset("photo") });
      }}>
        <div className="grid gap-1.5">
          <label htmlFor="photo-file" className="text-[13px] font-semibold">Add a photo</label>
          <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload.setData("photo", e.target.files?.[0] ?? null)} />
        </div>
        <Field label="Date" type="date" value={upload.data.date} onChange={(v) => upload.setData("date", v)} />
        <Button type="submit" variant="secondary" disabled={!upload.data.photo} loading={upload.processing}>Upload</Button>
      </form>
    </Section>
  );
}
