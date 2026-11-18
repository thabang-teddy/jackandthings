import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, FormError } from "@/components/ui/Alert";
import { Swatch } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";

type Category = { id: number; name: string; colour: string; glyph: string; uses: number };

export default function MoneyCategories({ categories, editing, seed_names }: { categories: Category[]; editing: number | null; seed_names: string[] }) {
  const [open, setOpen] = useState<Category | "new" | null>(editing ? categories.find((c) => c.id === editing) ?? null : null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const allSeeded = categories.length === seed_names.length && categories.every((c) => seed_names.includes(c.name));
  return (
    <>
      <PageHeader kicker="Money" title="Categories" actions={<Button onClick={() => setOpen("new")}>Add category</Button>} />
      <MoneyNav />
      {allSeeded && <div className="mb-6"><Alert tone="info">These are the 8 starter categories. Rename, recolour or delete them — they're yours.</Alert></div>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 border border-line bg-surface p-3">
            <Swatch colour={c.colour} glyph={c.glyph} size={30} />
            <div className="flex-1"><p className="font-semibold">{c.name}</p><p className="text-[12px] text-muted">{c.uses} transaction{c.uses === 1 ? "" : "s"}</p></div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(c)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(c)} aria-label={`Delete ${c.name}`}>×</Button>
          </li>
        ))}
      </ul>
      {open && <CategoryDialog category={open === "new" ? null : open} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.name}?`}
        body={`${removing?.uses ?? 0} transactions will become uncategorised. Its cap goes too.`} confirmLabel="Delete category"
        onConfirm={() => removing && router.delete(`/money/categories/${removing.id}/`)} />
    </>
  );
}

function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const form = useForm({ name: category?.name ?? "", colour: category?.colour ?? "#6B7280", glyph: category?.glyph ?? "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category) form.put(`/money/categories/${category.id}/`, { onSuccess: onClose });
    else form.post("/money/categories/", { onSuccess: onClose });
  };
  return (
    <Dialog open title={category ? "Edit category" : "Add a category"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Colour" type="color" value={form.data.colour} onChange={(v) => form.setData("colour", v)} error={form.errors.colour} />
          <Field label="Letter" maxLength={1} value={form.data.glyph} onChange={(v) => form.setData("glyph", v)} hint="Shown in the square." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
