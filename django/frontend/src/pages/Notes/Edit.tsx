import { Link, router, useForm } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { formatDateTime } from "@/lib/dates";

type Note = { id: number; title: string; body: string; updated_at: string };

export default function NoteEdit({ note }: { note: Note | null }) {
  const form = useForm({ title: note?.title ?? "", body: note?.body ?? "" });
  const [confirming, setConfirming] = useState(false);

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (note) form.put(`/notes/${note.id}/`, { preserveScroll: true });
    else form.post("/notes/");
  };

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <form onSubmit={save} className="mx-auto grid max-w-3xl gap-4">
      <p className="kicker"><Link href="/notes/" className="hover:underline">Notes</Link> / {note ? "Edit" : "New"}</p>
      <input aria-label="Title" placeholder="Untitled" value={form.data.title} autoFocus={!note}
        onChange={(e) => form.setData("title", e.target.value)}
        aria-invalid={!!form.errors.title}
        className="border-b border-field bg-transparent pb-2 font-serif text-4xl outline-none focus:border-text" />
      {form.errors.title && <p className="text-sm font-medium text-neg">{form.errors.title}</p>}
      <textarea aria-label="Note" rows={18} value={form.data.body} placeholder="Write…"
        onChange={(e) => form.setData("body", e.target.value)}
        className="min-h-[50vh] bg-transparent font-serif text-lg leading-relaxed outline-none" />
      <div className="sticky bottom-16 flex flex-wrap items-center gap-2 border-t border-line bg-bg py-3 md:bottom-0">
        <Button type="submit" loading={form.processing}>Save</Button>
        {note && <Button variant="ghost" onClick={() => setConfirming(true)}>Delete</Button>}
        <span className="text-sm text-muted">
          {form.isDirty ? "Unsaved changes" : note ? `Saved ${formatDateTime(note.updated_at)}` : ""}
        </span>
      </div>
      {note && (
        <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} title="Delete this note?"
          body={<>“{note.title}” will be gone for good. There's no undo.</>} confirmLabel="Delete note"
          onConfirm={() => router.delete(`/notes/${note.id}/`)} />
      )}
    </form>
  );
}
