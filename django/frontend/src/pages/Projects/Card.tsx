import { Link, router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { dueText, formatDateTime, formatDayMonth, formatTime, todayIso, toLocalInput } from "@/lib/dates";
import { formatDuration, formatHms, useElapsed } from "@/lib/time";

type Entry = { id: number; started_at: string; stopped_at: string | null; paused_at: string | null; paused_seconds: number;
  seconds: number; running: boolean; local_date: string };
type Note = { id: number; body: string; created_at: string; updated_at: string; edited: boolean };
type Props = {
  card: { id: number; title: string; description: string; due_date: string | null; labels: string[]; column_id: number;
    column: string; done: boolean; created_at: string };
  project: { id: number; name: string; colour: string };
  columns: { id: number; name: string }[];
  notes: Note[]; entries: Entry[]; timer: Entry | null; tracked_seconds: number; server_now: string;
};
const opts = { preserveScroll: true };

export default function CardPage(p: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const today = todayIso();
  return (
    <>
      <PageHeader
        kicker={<><Link href={`/projects/${p.project.id}/`} className="hover:underline">{p.project.name}</Link> / {p.card.column}</>}
        title={p.card.title}
        deck={<>
          {p.card.done && <Badge tone="pos">Done</Badge>}{" "}
          {p.card.due_date && !p.card.done && <span className={p.card.due_date < today ? "text-neg" : ""}>{dueText(p.card.due_date, today)}</span>}
        </>}
        actions={<>
          <Select label="Column" hideLabel value={p.card.column_id} options={p.columns.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => router.post(`/projects/cards/${p.card.id}/move/`, { column_id: Number(v), position: 0 }, opts)} />
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>Delete</Button>
        </>} />

      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-10">
          {p.card.description && <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{p.card.description}</p>}
          {p.card.labels.length > 0 && <div className="flex flex-wrap gap-2">{p.card.labels.map((l) => <Badge key={l}>{l}</Badge>)}</div>}
          <Notes cardId={p.card.id} notes={p.notes} />
        </div>
        <aside className="grid content-start gap-10">
          <TimerBlock {...p} />
          <Entries cardId={p.card.id} entries={p.entries} />
        </aside>
      </div>

      {editing && <EditCard card={p.card} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title="Delete this card?"
        body="Its notes and tracked time go with it. There's no undo." confirmLabel="Delete card"
        onConfirm={() => router.delete(`/projects/cards/${p.card.id}/`)} />
    </>
  );
}

function TimerBlock({ card, timer, tracked_seconds }: Props) {
  const running = timer ?? null;
  const elapsed = useElapsed(running?.started_at ?? new Date().toISOString(), running?.paused_seconds ?? 0,
    running ? running.paused_at : new Date().toISOString());
  const action = (a: string) => router.post(`/projects/cards/${card.id}/timer/${a}/`, {}, opts);
  return (
    <Section kicker="Time">
      <p role="timer" className={`num font-serif text-6xl ${running && !running.paused_at ? "" : "text-muted"}`}>
        {formatHms(running ? elapsed : 0)}
      </p>
      <p className="mt-1 text-sm text-muted">
        {formatDuration(tracked_seconds)} tracked on this card in total.
        {running?.paused_at && " Paused — paused time doesn't count."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!running && <Button variant="live" onClick={() => action("start")}>Start timer</Button>}
        {running && !running.paused_at && <Button onClick={() => action("pause")}>Pause</Button>}
        {running?.paused_at && <Button variant="live" onClick={() => action("resume")}>Resume</Button>}
        {running && <Button variant="secondary" onClick={() => action("stop")}>Stop</Button>}
      </div>
      <p className="mt-3 text-[13px] text-muted">One timer runs at a time. Starting this one stops any other.</p>
    </Section>
  );
}

function Notes({ cardId, notes }: { cardId: number; notes: Note[] }) {
  const form = useForm({ body: "" });
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <Section kicker={`Notes · ${notes.length}`}>
      <form className="mb-6 grid gap-2" onSubmit={(e) => {
        e.preventDefault();
        form.post(`/projects/cards/${cardId}/notes/`, { ...opts, onSuccess: () => form.reset() });
      }}>
        <TextArea label="Add a note" hideLabel placeholder="Add a note…" rows={3} value={form.data.body}
          onChange={(v) => form.setData("body", v)} error={form.errors.body} />
        <div><Button type="submit" size="sm" loading={form.processing} disabled={!form.data.body.trim()}>Add note</Button></div>
      </form>
      {notes.length === 0 ? <p className="text-muted">No notes yet. Decisions, links, phone numbers — anything about this card.</p> : (
        <ol className="grid gap-5">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-line pl-4">
              {editing === n.id ? <NoteEditor note={n} onDone={() => setEditing(null)} /> : (
                <>
                  <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    {formatDateTime(n.created_at)}{n.edited && " · edited"} ·{" "}
                    <button className="underline" onClick={() => setEditing(n.id)}>Edit</button> ·{" "}
                    <button className="underline" onClick={() => router.delete(`/projects/notes/${n.id}/`, opts)}>Delete</button>
                  </p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function NoteEditor({ note, onDone }: { note: Note; onDone: () => void }) {
  const form = useForm({ body: note.body });
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); form.put(`/projects/notes/${note.id}/`, { ...opts, onSuccess: onDone }); }}>
      <TextArea label="Edit note" hideLabel rows={4} value={form.data.body} onChange={(v) => form.setData("body", v)} error={form.errors.body} autoFocus />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={form.processing}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function Entries({ cardId, entries }: { cardId: number; entries: Entry[] }) {
  const [logging, setLogging] = useState<Entry | "new" | null>(null);
  const done = entries.filter((e) => !e.running);
  return (
    <Section kicker="Entries" action={<button className="text-sm font-semibold underline" onClick={() => setLogging("new")}>Log time</button>}>
      {done.length === 0 ? <p className="text-sm text-muted">No time logged yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {done.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1">{formatDayMonth(e.local_date)} · {formatTime(e.started_at)}</span>
              <span className="num">{formatDuration(e.seconds)}</span>
              <button className="text-[12px] text-muted underline" onClick={() => setLogging(e)}>Edit</button>
            </li>
          ))}
        </ul>
      )}
      {logging && <EntryDialog cardId={cardId} entry={logging === "new" ? null : logging} onClose={() => setLogging(null)} />}
    </Section>
  );
}

function EntryDialog({ cardId, entry, onClose }: { cardId: number; entry: Entry | null; onClose: () => void }) {
  const form = useForm({
    started_at: entry ? toLocalInput(entry.started_at) : toLocalInput(new Date(Date.now() - 3600_000).toISOString()),
    minutes: entry ? String(Math.round(entry.seconds / 60)) : "30",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = { ...opts, onSuccess: onClose };
    if (entry) form.put(`/projects/entries/${entry.id}/`, o);
    else form.post(`/projects/cards/${cardId}/entries/`, o);
  };
  return (
    <Dialog open title={entry ? "Edit entry" : "Log time"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Started" type="datetime-local" value={form.data.started_at} onChange={(v) => form.setData("started_at", v)} error={form.errors.started_at} />
        <Field label="Minutes" type="number" min={1} max={1440} value={form.data.minutes} onChange={(v) => form.setData("minutes", v)} error={form.errors.minutes} />
        <div className="flex flex-wrap justify-between gap-2">
          {entry ? <Button variant="ghost" onClick={() => { router.delete(`/projects/entries/${entry.id}/`, opts); onClose(); }}>Delete entry</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={form.processing}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function EditCard({ card, onClose }: { card: Props["card"]; onClose: () => void }) {
  const form = useForm({ title: card.title, description: card.description, due_date: card.due_date ?? "", labels: card.labels.join(", ") });
  return (
    <Dialog open wide title="Edit card" onClose={onClose}>
      <form className="grid gap-4" noValidate onSubmit={(e) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, labels: d.labels.split(",").map((s) => s.trim()).filter(Boolean) }));
        form.put(`/projects/cards/${card.id}/`, { ...opts, onSuccess: onClose });
      }}>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Title" value={form.data.title} onChange={(v) => form.setData("title", v)} error={form.errors.title} autoFocus />
        <TextArea label="Description" rows={6} value={form.data.description} onChange={(v) => form.setData("description", v)} error={form.errors.description} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due date" type="date" value={form.data.due_date} onChange={(v) => form.setData("due_date", v)} error={form.errors.due_date} />
          <Field label="Labels" value={form.data.labels} onChange={(v) => form.setData("labels", v)} hint="Comma-separated, up to 8." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.processing}>Save card</Button>
        </div>
      </form>
    </Dialog>
  );
}
