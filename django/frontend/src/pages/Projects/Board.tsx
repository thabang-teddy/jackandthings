import { Link, router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { ProjectsNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Kanban, type BoardCard, type BoardColumn } from "@/components/projects/Kanban";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { formatDayMonth } from "@/lib/dates";
import { ProjectDialog, type ProjectSummary } from "./Boards";

type Column = { id: number; name: string; wip_limit: number | null; cards: BoardCard[] };
type Props = { project: Omit<ProjectSummary, "open_cards" | "all_cards">; columns: Column[]; projects: ProjectSummary[] };

export default function ProjectBoard({ project, columns }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [columnEdit, setColumnEdit] = useState<Column | "new" | null>(null);
  const board: BoardColumn[] = columns.map((c) => ({ key: String(c.id), name: c.name, wip_limit: c.wip_limit, cards: c.cards }));
  const options = columns.map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHeader kicker={<Link href="/projects/" className="hover:underline">Projects</Link>}
        title={project.name} deck={project.due_date ? `Due ${formatDayMonth(project.due_date)}` : undefined}
        actions={<>
          <Button variant="secondary" onClick={() => setColumnEdit("new")}>Add column</Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit project</Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>Delete</Button>
        </>} />
      <ProjectsNav />
      <Kanban columns={board} targetFor={(_card, col) => Number(col.key)} moveOptions={() => options}
        footer={(col) => (
          <div className="mt-3 grid gap-2">
            <AddCard projectId={project.id} columnId={Number(col.key)} />
            <button className="text-left text-[12px] text-muted underline" onClick={() => setColumnEdit(columns.find((c) => String(c.id) === col.key) ?? null)}>
              Column settings
            </button>
          </div>
        )} />
      {editing && <ProjectDialog project={{ ...project, open_cards: 0, all_cards: 0 }} onClose={() => setEditing(false)} />}
      {columnEdit && <ColumnDialog projectId={project.id} column={columnEdit === "new" ? null : columnEdit} onClose={() => setColumnEdit(null)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title={`Delete ${project.name}?`}
        body="Every card, card note and tracked time entry in this project will be deleted. There's no undo."
        confirmLabel="Delete project" onConfirm={() => router.delete(`/projects/${project.id}/`)} />
    </>
  );
}

function AddCard({ projectId, columnId }: { projectId: number; columnId: number }) {
  const form = useForm({ title: "", column_id: String(columnId), due_date: "" });
  const [open, setOpen] = useState(false);
  if (!open) return <button className="h-8 text-left text-[13px] font-semibold text-muted hover:text-text" onClick={() => setOpen(true)}>+ Add a card</button>;
  return (
    <form className="grid gap-2" onSubmit={(e) => {
      e.preventDefault();
      form.post(`/projects/${projectId}/cards/`, { preserveScroll: true, onSuccess: () => form.reset("title", "due_date") });
    }}>
      <Field label="Card title" hideLabel placeholder="Card title" value={form.data.title} onChange={(v) => form.setData("title", v)}
        error={form.errors.title} autoFocus onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={form.processing}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function ColumnDialog({ projectId, column, onClose }: { projectId: number; column: Column | null; onClose: () => void }) {
  const form = useForm({ name: column?.name ?? "", wip_limit: column?.wip_limit ? String(column.wip_limit) : "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = { onSuccess: onClose, preserveScroll: true };
    if (column) form.put(`/projects/columns/${column.id}/`, o);
    else form.post(`/projects/${projectId}/columns/`, o);
  };
  return (
    <Dialog open title={column ? `Column: ${column.name}` : "Add a column"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus
          hint="A column called “Done” marks its cards complete." />
        <Field label="Work-in-progress limit" type="number" min={1} value={form.data.wip_limit}
          onChange={(v) => form.setData("wip_limit", v)} error={form.errors.wip_limit} hint="Optional. The count turns amber at the limit." />
        <div className="flex flex-wrap justify-between gap-2">
          {column ? <Button variant="ghost" onClick={() => { router.delete(`/projects/columns/${column.id}/`, { preserveScroll: true }); onClose(); }}>
            Delete column</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={form.processing}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
