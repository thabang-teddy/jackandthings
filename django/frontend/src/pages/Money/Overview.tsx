import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import { MoneyNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionDialog, type MoneyChoices, type Tx } from "@/components/money/TransactionDialog";
import { Swatch } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Meter, Progress } from "@/components/ui/Meter";
import { Section, Stat } from "@/components/ui/Section";
import { formatDayMonth, formatMonthYear } from "@/lib/dates";
import { formatSigned, formatZar } from "@/lib/money";

export type Account = { id: number; name: string; kind: string; archived: boolean; opening_cents: number; balance_cents: number };
export type CapRow = { id: number; category_id: number; category: string; colour: string; cap_cents: number; spent_cents: number;
  over_cents: number; pct: number; warn: boolean; warn_at_pct: number; pace: number };
export type Goal = { id: number; name: string; target_cents: number; saved_cents: number; remaining_cents: number;
  monthly_cents: number | null; target_date: string | null; done: boolean; pct: number };
export type RecurringItem = { id: number; name: string; amount_cents: number; cadence: string; next_date: string;
  account: { id: number; name: string }; category: { id: number; name: string } | null; auto_post: boolean; active: boolean; due: boolean };

type Props = MoneyChoices & { accounts: Account[]; total_cents: number; month: { out_cents: number; in_cents: number };
  caps: CapRow[]; recent: Tx[]; due: RecurringItem[]; goals: Goal[]; today: string };

export default function MoneyOverview(p: Props) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader kicker="Money" title={formatZar(p.total_cents)} deck="Across all your accounts, right now."
        actions={<Button onClick={() => setAdding(true)}>Add transaction</Button>} />
      <MoneyNav />
      {p.accounts.length === 0 ? (
        <EmptyState title="Start with an account." body="Your cheque account and what's in it today. Everything else builds on that."
          action={<ButtonLink href="/money/accounts/" variant="primary">Add an account</ButtonLink>} />
      ) : (
        <div className="grid gap-12">
          <div className="grid gap-6 sm:grid-cols-3">
            <Stat label={`Spent in ${formatMonthYear(p.today)}`} value={formatZar(p.month.out_cents)} />
            <Stat label="Came in" value={formatZar(p.month.in_cents)} />
            <Stat label="Net" value={formatSigned(p.month.in_cents - p.month.out_cents)} sub="Transfers don't count" />
          </div>

          {p.due.length > 0 && (
            <Section kicker="Due">
              <ul className="divide-y divide-line border-y border-line">
                {p.due.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <i aria-hidden className={r.next_date < p.today ? "size-2.5 rotate-45 bg-neg" : "size-2.5 bg-warn"} />
                    <span className="flex-1 font-semibold">{r.name} <span className="font-normal text-muted">· {formatDayMonth(r.next_date)}</span></span>
                    <span className="num">{formatSigned(r.amount_cents)}</span>
                    <Button size="sm" onClick={() => router.post(`/money/recurring/${r.id}/confirm/`, {}, { preserveScroll: true })}>Paid</Button>
                    <Button size="sm" variant="ghost" onClick={() => router.post(`/money/recurring/${r.id}/skip/`, {}, { preserveScroll: true })}>Skip</Button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-12 lg:grid-cols-2">
            <Section kicker="Accounts" action={<Link href="/money/accounts/" className="text-sm font-semibold underline">Manage</Link>}>
              <ul className="divide-y divide-line">
                {p.accounts.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between py-3">
                    <Link href={`/money/transactions/?account=${a.id}`} className="hover:underline">
                      <span className="font-semibold">{a.name}</span> <span className="text-[13px] text-muted">{a.kind}</span>
                    </Link>
                    <span className={`num font-serif text-xl ${a.balance_cents < 0 ? "text-neg" : ""}`}>{formatZar(a.balance_cents)}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section kicker="Caps this month" action={<Link href="/money/caps/" className="text-sm font-semibold underline">Edit caps</Link>}>
              {p.caps.length === 0 ? <p className="text-muted">No caps yet. A cap is a monthly limit for one category.</p> : (
                <div className="grid gap-5">{p.caps.map((c) => <Meter key={c.id} label={c.category} spent={c.spent_cents} cap={c.cap_cents} pace={c.pace} warn={c.warn} />)}</div>
              )}
            </Section>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <Section kicker="Recent" action={<Link href="/money/transactions/" className="text-sm font-semibold underline">All transactions</Link>}>
              {p.recent.length === 0 ? <p className="text-muted">No transactions yet.</p> : (
                <ul className="divide-y divide-line">
                  {p.recent.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <Swatch colour={t.category?.colour ?? "#8E887B"} glyph={t.transfer ? "⇄" : t.category?.glyph ?? "·"} />
                      <span className="flex-1 truncate">{t.description}</span>
                      <span className="text-[13px] text-muted">{formatDayMonth(t.date)}</span>
                      <span className={`num w-28 text-right ${t.amount_cents > 0 ? "text-pos" : ""}`}>{formatSigned(t.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section kicker="Goals" action={<Link href="/money/goals/" className="text-sm font-semibold underline">All goals</Link>}>
              {p.goals.length === 0 ? <p className="text-muted">Saving for something? Make it a goal.</p> : (
                <ul className="grid gap-5">
                  {p.goals.map((g) => (
                    <li key={g.id} className="grid gap-1.5">
                      <p className="flex justify-between text-sm"><b>{g.name}</b><span className="num">{formatZar(g.saved_cents)} of {formatZar(g.target_cents)}</span></p>
                      <Progress value={g.saved_cents} max={g.target_cents} label={`${g.name} progress`} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
      {adding && <TransactionDialog tx={null} choices={p} onClose={() => setAdding(false)} />}
    </>
  );
}
