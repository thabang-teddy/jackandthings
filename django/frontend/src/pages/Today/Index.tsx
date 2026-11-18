import { Link } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Section, Stat } from "@/components/ui/Section";
import { BarChart } from "@/components/ui/BarChart";
import { formatDayMonth, formatLongDay, formatWeekday } from "@/lib/dates";
import { formatZar } from "@/lib/money";
import { formatDuration } from "@/lib/time";

type Attention = { kind: "over" | "overdue" | "due" | "suggestion"; title: string; href: string;
  detail?: string; detail_cents?: number; project?: string };
type Props = {
  server_now: string; date: string; greeting: string; deck: string; first_run: boolean; attention: Attention[];
  figures: { focus_minutes: number; tracked_seconds: number; total_balance_cents: number | null;
    training: { streak_weeks: number; this_week: number } };
  notes: { id: number; title: string; snippet: string; updated_at: string }[];
  week: { date: string; minutes: number; is_today: boolean }[];
};

function useClock(serverNow: string) {
  const offset = Date.parse(serverNow) - Date.now(); // trust the server's clock
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 15_000);
    return () => window.clearInterval(id);
  }, [offset]);
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(now);
}

const marker = { over: "size-2.5 rotate-45 bg-neg", overdue: "size-2.5 rotate-45 bg-neg", due: "size-2.5 bg-warn", suggestion: "size-2.5 rounded-full border-2 border-accent" };

export default function TodayIndex(p: Props) {
  const time = useClock(p.server_now);
  return (
    <div className="grid gap-12">
      <header className="grid gap-2">
        <p className="kicker">{formatLongDay(p.date)}</p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-serif text-5xl font-medium tracking-tight md:text-6xl">{p.greeting}</h1>
            <p className="mt-3 max-w-xl font-serif text-xl text-muted">{p.deck}</p>
          </div>
          <p className="num font-serif text-7xl leading-none md:text-8xl" aria-label={`The time is ${time}`}>{time}</p>
        </div>
      </header>

      {p.first_run ? <FirstRun /> : (
        <>
          <Section kicker="Needs attention" title={p.attention.length ? undefined : "Nothing needs you right now."}>
            {p.attention.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {p.attention.map((a) => (
                  <li key={a.title + a.href}>
                    <Link href={a.href} className="flex items-center gap-4 py-3.5 hover:bg-surface">
                      <i aria-hidden className={`shrink-0 ${marker[a.kind]}`} />
                      <span className="flex-1">
                        <span className="font-semibold">{a.title}</span>
                        {a.project && <span className="text-muted"> · {a.project}</span>}
                      </span>
                      <span className="num text-sm text-muted">
                        {a.detail_cents !== undefined ? `${formatZar(a.detail_cents)} over` : a.detail ? formatDayMonth(a.detail) : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Focus today" value={`${p.figures.focus_minutes} min`} sub={<Link href="/focus/" className="underline">Open timer</Link>} />
            <Stat label="Tracked today" value={formatDuration(p.figures.tracked_seconds)} sub={<Link href="/projects/time/" className="underline">Timesheet</Link>} />
            <Stat label="All accounts" value={p.figures.total_balance_cents === null ? "—" : formatZar(p.figures.total_balance_cents)}
              sub={<Link href="/money/" className="underline">Money</Link>} />
            <Stat label="Training streak" value={`${p.figures.training.streak_weeks} wk`}
              sub={`${p.figures.training.this_week} session${p.figures.training.this_week === 1 ? "" : "s"} this week`} />
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <Section kicker="Focus · last 7 days">
              <BarChart caption="Focus minutes per day, last 7 days"
                items={p.week.map((d) => ({ label: formatWeekday(d.date), value: d.minutes, display: `${d.minutes}m`, highlight: d.is_today }))} />
            </Section>
            <Section kicker="Latest notes" action={<Link href="/notes/" className="text-sm font-semibold underline">All notes</Link>}>
              {p.notes.length === 0 ? <p className="text-muted">No notes yet.</p> : (
                <ul className="grid gap-4">
                  {p.notes.map((n) => (
                    <li key={n.id}>
                      <Link href={`/notes/${n.id}/`} className="group block">
                        <p className="font-serif text-lg group-hover:underline">{n.title}</p>
                        {n.snippet && <p className="line-clamp-2 text-sm text-muted">{n.snippet}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function FirstRun() {
  const steps = [
    { href: "/focus/", title: "Start a focus session", body: "25 minutes on one thing. The timer keeps going if you switch pages." },
    { href: "/projects/", title: "Make your first project", body: "A board with five columns, cards with notes and a timer." },
    { href: "/money/accounts/", title: "Add a money account", body: "Your cheque account and its balance today. Categories are ready for you." },
    { href: "/notes/new/", title: "Write a note", body: "Anything — a list, a thought, a plan." },
  ];
  return (
    <Section kicker="Getting started" title="Four ways to begin">
      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.href} className="border border-line bg-surface p-5">
            <p className="kicker">Step {i + 1}</p>
            <p className="mt-1 font-serif text-xl">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
            <ButtonLink href={s.href} variant="secondary" size="sm" className="mt-4">Go</ButtonLink>
          </li>
        ))}
      </ol>
    </Section>
  );
}
