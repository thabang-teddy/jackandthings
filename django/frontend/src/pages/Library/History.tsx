import { router, useForm } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { LibraryNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Pager } from "@/components/ui/Pager";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { formatDateTime, formatLongDay, toLocalInput } from "@/lib/dates";
import type { Paged } from "@/lib/types";

type Visit = { id: number; url: string; title: string; visited_at: string };
type Token = { id: number; name: string; created_at: string; last_used_at: string | null };
type Props = Paged<Visit> & { q: string; retention_days: number; next_purge: { at: string; count: number }; tokens: Token[]; new_token: string | null };

const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };

export default function LibraryHistory(p: Props) {
  const [search, setSearch] = useState(p.q);
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (search === p.q) return;
    const id = window.setTimeout(() => router.get("/library/history/", search ? { q: search } : {}, { preserveState: true, replace: true }), 300);
    return () => window.clearTimeout(id);
  }, [search, p.q]);
  const days: { day: string; visits: Visit[] }[] = [];
  for (const v of p.items) {
    const day = toLocalInput(v.visited_at).slice(0, 10); // group by Johannesburg day, not UTC
    const last = days[days.length - 1];
    if (last?.day === day) last.visits.push(v); else days.push({ day, visits: [v] });
  }
  return (
    <>
      <PageHeader kicker="Library" title="History" deck="Pages the browser extension saved for you. Only you can see them."
        actions={<Button variant="secondary" onClick={() => setClearing(true)}>Clear a range</Button>} />
      <LibraryNav />
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-5 max-w-md"><Field label="Search history" hideLabel type="search" placeholder="Search titles and addresses" value={search} onChange={setSearch} /></div>
          {p.items.length === 0 ? <EmptyState title={p.q ? "Nothing matches." : "No history yet."}
            body={p.q ? undefined : "Install the browser extension and paste a token from the right-hand panel."} /> : (
            <div className="grid gap-6">
              {days.map((d) => (
                <section key={d.day} aria-label={formatLongDay(d.day)}>
                  <h2 className="kicker border-b border-line pb-1.5">{formatLongDay(d.day)}</h2>
                  <ul className="divide-y divide-line">
                    {d.visits.map((v) => (
                      <li key={v.id} className="flex items-center gap-3 py-2.5">
                        <span className="num w-12 text-[13px] text-muted">{formatDateTime(v.visited_at).split(", ")[1]}</span>
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                          <span className="block truncate font-medium hover:underline">{v.title || v.url}</span>
                          <span className="block truncate text-[12px] text-muted">{host(v.url)}</span>
                        </a>
                        <button aria-label={`Delete ${v.title || v.url}`} className="px-2 text-muted hover:text-neg"
                          onClick={() => router.delete(`/library/history/${v.id}/`, { preserveScroll: true })}>×</button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <Pager page={p.page} pages={p.pages} total={p.total} noun="visits" />
        </div>
        <aside className="grid content-start gap-10">
          <Retention days={p.retention_days} next={p.next_purge} />
          <Tokens tokens={p.tokens} newToken={p.new_token} />
        </aside>
      </div>
      {clearing && <ClearDialog onClose={() => setClearing(false)} />}
    </>
  );
}

function Retention({ days, next }: { days: number; next: { at: string; count: number } }) {
  return (
    <Section kicker="Keep history for">
      <Select label="Retention" hideLabel value={days} onChange={(v) => router.put("/library/history/retention/", { days: Number(v) }, { preserveScroll: true })}
        options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }, { value: 365, label: "1 year" }]} />
      <p className="mt-2 text-[13px] text-muted">
        Next clean-up {formatDateTime(next.at)}: {next.count === 0 ? "nothing to remove." : `${next.count} visit${next.count === 1 ? "" : "s"} will be deleted.`}
      </p>
    </Section>
  );
}

function Tokens({ tokens, newToken }: { tokens: Token[]; newToken: string | null }) {
  const form = useForm({ name: "" });
  return (
    <Section kicker="Extension tokens">
      {newToken && (
        <div className="mb-4"><Alert tone="success" title="Copy this token now — it won't be shown again.">
          <code className="mt-2 block break-all bg-surface2 p-2 text-[13px]">{newToken}</code>
          <button className="mt-2 text-[13px] font-semibold underline" onClick={() => navigator.clipboard?.writeText(newToken)}>Copy</button>
        </Alert></div>
      )}
      {tokens.length > 0 && (
        <ul className="mb-4 divide-y divide-line text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <span className="flex-1"><b>{t.name}</b><span className="block text-[12px] text-muted">
                {t.last_used_at ? `Last used ${formatDateTime(t.last_used_at)}` : "Never used"}</span></span>
              <button className="text-[12px] text-neg underline" onClick={() => router.delete(`/library/tokens/${t.id}/`, { preserveScroll: true })}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); form.post("/library/tokens/", { preserveScroll: true, onSuccess: () => form.reset() }); }}>
        <Field label="Token name" placeholder="e.g. Work laptop" value={form.data.name} onChange={(v) => form.setData("name", v)} />
        <Button type="submit" variant="secondary" loading={form.processing}>Create token</Button>
      </form>
    </Section>
  );
}

function ClearDialog({ onClose }: { onClose: () => void }) {
  const now = new Date().toISOString();
  const form = useForm({ start: toLocalInput(new Date(Date.now() - 3600_000).toISOString()), end: toLocalInput(now) });
  return (
    <Dialog open title="Clear history" onClose={onClose} tone="neg">
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/library/history/clear/", { onSuccess: onClose }); }}>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="From" type="datetime-local" value={form.data.start} onChange={(v) => form.setData("start", v)} error={form.errors.start} />
        <Field label="To" type="datetime-local" value={form.data.end} onChange={(v) => form.setData("end", v)} error={form.errors.end} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} autoFocus>Cancel</Button>
          <Button type="submit" variant="danger" loading={form.processing}>Delete visits</Button>
        </div>
      </form>
    </Dialog>
  );
}
