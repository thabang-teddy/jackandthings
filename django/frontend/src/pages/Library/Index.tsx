import { Link, router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { LibraryNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

type WatchList = { id: number; name: string; open: number };
type Item = { id: number; title: string; url: string; note: string; done: boolean; list_id: number };
type Props = { lists: WatchList[]; selected: number | null; items: Item[] };
const opts = { preserveScroll: true };

export default function LibraryIndex({ lists, selected, items }: Props) {
  const [newList, setNewList] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deletingList, setDeletingList] = useState(false);
  const current = lists.find((l) => l.id === selected) ?? null;
  const open = items.filter((i) => !i.done), done = items.filter((i) => i.done);
  return (
    <>
      <PageHeader kicker="Library" title="Watch list" deck="Films, shows, books, articles — things for later."
        actions={<Button variant="secondary" onClick={() => setNewList(true)}>New list</Button>} />
      <LibraryNav />
      {lists.length === 0 ? <EmptyState title="No lists yet." body="Start with one, e.g. Films." action={<Button onClick={() => setNewList(true)}>Make a list</Button>} /> : (
        <div className="grid gap-10 md:grid-cols-[220px_1fr]">
          <nav aria-label="Lists">
            <ul className="grid gap-1">
              {lists.map((l) => (
                <li key={l.id}>
                  <Link href={`/library/?list=${l.id}`} preserveScroll aria-current={l.id === selected ? "page" : undefined}
                    className={`flex justify-between px-3 py-2 text-sm ${l.id === selected ? "bg-prim font-semibold text-prim-ink" : "hover:bg-tint"}`}>
                    {l.name}<span className="num opacity-70">{l.open}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {current && (
            <div>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-3xl">{current.name}</h2>
                <button className="text-[13px] text-muted underline" onClick={() => setDeletingList(true)}>Delete list</button>
              </div>
              <AddItem listId={current.id} />
              {open.length === 0 && done.length === 0 && <p className="mt-6 text-muted">Nothing here yet.</p>}
              <ItemList items={open} onEdit={setEditing} />
              {done.length > 0 && (
                <details className="mt-6"><summary className="kicker cursor-pointer">Done · {done.length}</summary><ItemList items={done} onEdit={setEditing} /></details>
              )}
            </div>
          )}
        </div>
      )}
      {newList && <NewListDialog onClose={() => setNewList(false)} />}
      {editing && <EditItemDialog item={editing} lists={lists} onClose={() => setEditing(null)} />}
      {current && <ConfirmDialog open={deletingList} onClose={() => setDeletingList(false)} title={`Delete ${current.name}?`}
        body={`Its ${items.length} item${items.length === 1 ? "" : "s"} go with it.`} confirmLabel="Delete list"
        onConfirm={() => router.delete(`/library/lists/${current.id}/`)} />}
    </>
  );
}

function ItemList({ items, onEdit }: { items: Item[]; onEdit: (i: Item) => void }) {
  return (
    <ul className="mt-4 divide-y divide-line border-y border-line">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 py-3">
          <input type="checkbox" checked={i.done} aria-label={`Mark ${i.title} ${i.done ? "not done" : "done"}`} className="size-[18px] accent-[var(--accent)]"
            onChange={() => router.put(`/library/items/${i.id}/`, { title: i.title, url: i.url, note: i.note, done: !i.done }, opts)} />
          <div className="min-w-0 flex-1">
            <p className={i.done ? "text-muted line-through" : "font-medium"}>
              {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="underline">{i.title}</a> : i.title}
            </p>
            {i.note && <p className="truncate text-[13px] text-muted">{i.note}</p>}
          </div>
          <button className="text-[12px] text-muted underline" onClick={() => onEdit(i)}>Edit</button>
        </li>
      ))}
    </ul>
  );
}

function AddItem({ listId }: { listId: number }) {
  const form = useForm({ title: "", url: "", note: "" });
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" noValidate
      onSubmit={(e) => { e.preventDefault(); form.post(`/library/lists/${listId}/items/`, { ...opts, onSuccess: () => form.reset() }); }}>
      <Field label="Title" hideLabel placeholder="Add a title…" value={form.data.title} onChange={(v) => form.setData("title", v)} error={form.errors.title} />
      <Field label="Link" hideLabel placeholder="Link (optional)" type="url" value={form.data.url} onChange={(v) => form.setData("url", v)} error={form.errors.url} />
      <Button type="submit" loading={form.processing}>Add</Button>
    </form>
  );
}

function NewListDialog({ onClose }: { onClose: () => void }) {
  const form = useForm({ name: "" });
  return (
    <Dialog open title="New list" onClose={onClose}>
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/library/", { onSuccess: onClose }); }}>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoFocus />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={form.processing}>Create</Button></div>
      </form>
    </Dialog>
  );
}

function EditItemDialog({ item, lists, onClose }: { item: Item; lists: WatchList[]; onClose: () => void }) {
  const form = useForm({ title: item.title, url: item.url, note: item.note, done: item.done, list_id: String(item.list_id) });
  return (
    <Dialog open title="Edit item" onClose={onClose}>
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.put(`/library/items/${item.id}/`, { ...opts, onSuccess: onClose }); }}>
        <Field label="Title" value={form.data.title} onChange={(v) => form.setData("title", v)} error={form.errors.title} />
        <Field label="Link" type="url" value={form.data.url} onChange={(v) => form.setData("url", v)} error={form.errors.url} />
        <Field label="Note" value={form.data.note} onChange={(v) => form.setData("note", v)} />
        <Select label="List" value={form.data.list_id} onChange={(v) => form.setData("list_id", v)} options={lists.map((l) => ({ value: l.id, label: l.name }))} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => { router.delete(`/library/items/${item.id}/`, opts); onClose(); }}>Delete</Button>
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={form.processing}>Save</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
