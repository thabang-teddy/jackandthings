import { Link, router } from "@inertiajs/react";
import { ProjectsNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatLongDay, formatMonthYear } from "@/lib/dates";
import { formatDuration } from "@/lib/time";

type Day = { date: string; in_month: boolean; due: { id: number; title: string; colour: string; done: boolean }[]; tracked_seconds: number };
type Props = { year: number; month: number; days: Day[]; today: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ProjectCalendar({ year, month, days, today }: Props) {
  const go = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    router.get("/projects/calendar/", { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }, { preserveScroll: true });
  };
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const agenda = days.filter((d) => d.in_month && (d.due.length || d.tracked_seconds));
  return (
    <>
      <PageHeader kicker="Projects" title={formatMonthYear(first)} actions={<>
        <Button variant="secondary" onClick={() => go(-1)} aria-label="Previous month">←</Button>
        <Button variant="secondary" onClick={() => router.get("/projects/calendar/")}>This month</Button>
        <Button variant="secondary" onClick={() => go(1)} aria-label="Next month">→</Button>
      </>} />
      <ProjectsNav />

      {/* Desktop: a 7 × 6 grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b-2 border-text text-[12px] font-semibold uppercase tracking-wider text-muted">
          {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>
        <ol className="grid grid-cols-7 border-l border-line">
          {days.map((d) => (
            <li key={d.date} aria-label={formatLongDay(d.date)}
              className={`min-h-[112px] border-r border-b border-line p-2 ${d.in_month ? "" : "bg-surface text-muted"} ${d.date === today ? "outline-2 -outline-offset-2 outline-accent" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className={`num text-sm ${d.date === today ? "font-bold text-accent" : ""}`}>{Number(d.date.slice(8))}</span>
                {d.tracked_seconds > 0 && <span className="num text-[11px] text-muted">{formatDuration(d.tracked_seconds)}</span>}
              </div>
              <ul className="mt-1 grid gap-1">
                {d.due.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link href={`/projects/cards/${c.id}/`} className={`flex items-center gap-1.5 truncate text-[12px] hover:underline ${c.done ? "text-muted line-through" : ""}`}>
                      <i aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.colour }} />{c.title}
                    </Link>
                  </li>
                ))}
                {d.due.length > 3 && <li className="text-[11px] text-muted">+{d.due.length - 3} more</li>}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      {/* Mobile: an agenda list */}
      <div className="md:hidden">
        {agenda.length === 0 ? <p className="text-muted">Nothing due and no time tracked this month.</p> : (
          <ol className="divide-y divide-line border-y border-line">
            {agenda.map((d) => (
              <li key={d.date} className="py-3">
                <p className="flex justify-between text-sm font-semibold">
                  <span>{formatLongDay(d.date)}</span>
                  {d.tracked_seconds > 0 && <span className="num font-normal text-muted">{formatDuration(d.tracked_seconds)}</span>}
                </p>
                <ul className="mt-1 grid gap-1">
                  {d.due.map((c) => (
                    <li key={c.id}><Link href={`/projects/cards/${c.id}/`} className="flex items-center gap-2 text-sm underline">
                      <i aria-hidden className="size-2 rounded-full" style={{ background: c.colour }} />{c.title}</Link></li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
