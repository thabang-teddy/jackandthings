import { Link, router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { ProjectsNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Kanban, type BoardCard, type BoardColumn } from "@/components/projects/Kanban";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";

export type ProjectSummary = { id: number; name: string; colour: string; archived: boolean; due_date: string | null;
  open_cards: number; all_cards: number };
type Props = { projects: ProjectSummary[]; columns: { name: string; cards: (BoardCard & { column_id: number })[] }[];
  columns_by_project: Record<string, { id: number; name: string }[]>; filter: number[] };

export default function ProjectBoards({ projects, columns, columns_by_project, filter }: Props) {
  const [creating, setCreating] = useState(false);
  const toggle = (id: number) => {
    const next = filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id];
    router.get("/projects/", next.length ? { p: next } : {}, { preserveState: true, preserveScroll: true });
  };
  const board: BoardColumn[] = columns.map((c) => ({ key: c.name, name: c.name, cards: c.cards }));
  return (
    <>
      <PageHeader kicker="Projects" title="All projects" deck="Every active project on one board, grouped by column."
        actions={<Button onClick={() => setCreating(true)}>New project</Button>} />
      <ProjectsNav />
      {projects.length === 0 ? (
        <EmptyState title="No projects yet." body="A project is a board with five columns. Cards hold notes and a timer."
          action={<Button onClick={() => setCreating(true)}>Create the first one</Button>} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="kicker mr-2">Show</span>
            {projects.map((p) => (
              <Chip key={p.id} selected={filter.length === 0 || filter.includes(p.id)} onClick={() => toggle(p.id)}>
                <span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2 rounded-full" style={{ background: p.colour }} />{p.name}</span>
              </Chip>
            ))}
          </div>
          <Kanban columns={board} showProject
            targetFor={(card, col) => columns_by_project[card.project.id]?.find((c) => c.name === col.name)?.id ?? null}
            moveOptions={(card) => columns_by_project[card.project.id] ?? []} />
          <h2 className="kicker mt-10 mb-3">Boards</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}/`} className="flex items-center gap-3 border border-line bg-surface p-4 hover:border-text">
                  <i aria-hidden className="h-8 w-1.5" style={{ background: p.colour }} />
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="num text-[13px] text-muted">{p.open_cards} open</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && <ProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}

export function ProjectDialog({ project, onClose }: { project?: ProjectSummary; onClose: () => void }) {
  const form = useForm({ name: project?.name ?? "", colour: project?.colour ?? "#1F4FD1", due_date: project?.due_date ?? "",
    archived: project?.archived ?? false });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (project) form.put(`/projects/${project.id}/`, { onSuccess: onClose });
    else form.post("/projects/");
  };
  return (
    <Dialog open title={project ? "Edit project" : "New project"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Colour" type="color" value={form.data.colour} onChange={(v) => form.setData("colour", v)} error={form.errors.colour} />
          <Field label="Due date" type="date" value={form.data.due_date} onChange={(v) => form.setData("due_date", v)} error={form.errors.due_date} />
        </div>
        {project && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.data.archived} onChange={(e) => form.setData("archived", e.target.checked)} />
            Archived (hidden from the all-projects board)
          </label>
        )}
        {!project && <p className="text-[13px] text-muted">It starts with Backlog, To do, Doing, Review and Done.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>{project ? "Save" : "Create project"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
