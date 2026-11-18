import { router } from "@inertiajs/react";
import { FocusNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { ButtonLink } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/dates";
import type { Paged } from "@/lib/types";

type Row = { id: number; phase: string; tag: string; started_at: string; minutes: number; completed: boolean; preset: string | null };
const PHASE: Record<string, string> = { focus: "Focus", short: "Short break", long: "Long break" };

export default function FocusSessions({ items, page, pages, total }: Paged<Row>) {
  return (
    <>
      <PageHeader kicker="Focus" title="History" />
      <FocusNav />
      {items.length === 0 ? (
        <EmptyState title="No sessions yet." action={<ButtonLink href="/focus/" variant="primary">Start one</ButtonLink>} />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-text text-[12px] uppercase tracking-wider text-muted">
            <tr><th className="py-2">When</th><th>Phase</th><th>Tag</th><th className="text-right">Minutes</th><th /><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((s) => (
              <tr key={s.id}>
                <td className="py-3">{formatDateTime(s.started_at)}</td>
                <td>{PHASE[s.phase] ?? s.phase}</td>
                <td>{s.tag || <span className="text-muted">—</span>}</td>
                <td className="num text-right">{s.minutes}</td>
                <td className="pl-3">{s.completed ? <Badge tone="pos">Counted</Badge> : <Badge>Stopped</Badge>}</td>
                <td className="text-right">
                  <button className="text-[13px] font-semibold text-muted underline hover:text-neg"
                    onClick={() => router.delete(`/focus/sessions/${s.id}/`, { preserveScroll: true })}>
                    Delete<span className="sr-only"> session from {formatDateTime(s.started_at)}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} pages={pages} total={total} noun="sessions" />
    </>
  );
}
