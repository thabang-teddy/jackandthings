import { Link, router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Pager } from "@/components/ui/Pager";
import { formatDateTime } from "@/lib/dates";
import type { Paged } from "@/lib/types";

type Note = { id: number; title: string; snippet: string; updated_at: string };

export default function NotesIndex({ items, page, pages, total, q }: Paged<Note> & { q: string }) {
  const [search, setSearch] = useState(q);
  // Search as you type, 300 ms after the last key. replace: true keeps history clean.
  useEffect(() => {
    if (search === q) return;
    const id = window.setTimeout(() => router.get("/notes/", search ? { q: search } : {}, { preserveState: true, replace: true }), 300);
    return () => window.clearTimeout(id);
  }, [search, q]);

  return (
    <>
      <PageHeader kicker="Notes" title="Notes" actions={<ButtonLink href="/notes/new/" variant="primary">New note</ButtonLink>} />
      <div className="mb-6 max-w-md">
        <Field label="Search notes" hideLabel type="search" placeholder="Search titles and text" value={search} onChange={setSearch} />
      </div>
      {items.length === 0 ? (
        q ? <EmptyState title={`Nothing matches “${q}”.`} body="Try fewer words, or clear the search." />
          : <EmptyState title="No notes yet." body="Notes are for anything: a list, a thought, a plan."
              action={<ButtonLink href="/notes/new/" variant="primary">Write the first one</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}/`} className="grid gap-1 py-4 hover:bg-surface md:grid-cols-[1fr_auto] md:gap-6">
                <span>
                  <span className="font-serif text-xl">{n.title}</span>
                  {n.snippet && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{n.snippet}</span>}
                </span>
                <span className="text-[13px] text-muted">{formatDateTime(n.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pages={pages} total={total} noun="notes" />
    </>
  );
}
