import { Link, router, usePage } from "@inertiajs/react";
import type { Now, NowFocus, NowTimer, SharedProps } from "@/lib/types";
import { formatMs, useCountdown, useElapsed } from "@/lib/time";

/** "What's running elsewhere": live first (cyan), then broken (red diamond), then due (amber square). */
export function NowLine() {
  const page = usePage();
  const now = (page.props as unknown as SharedProps).now as Now | null;
  const url = page.url;
  if (!now) return null;
  // The page that owns a timer already shows it big; hide that item here.
  const timer = now.timer && !url.startsWith(`/projects/cards/${now.timer.card_id}/`) ? now.timer : null;
  const focus = now.focus && !url.startsWith("/focus") ? now.focus : null;
  if (!timer && !focus && !now.alerts.length) return null;
  return (
    <div role="status" aria-label="Running elsewhere"
      className="flex min-h-[38px] items-center gap-5 overflow-x-auto border-b border-line bg-surface px-4 text-[13px] md:px-10">
      <span className="text-[10.5px] font-bold tracking-[.12em] text-muted">NOW</span>
      {focus && <FocusItem f={focus} serverNow={now.server_now} />}
      {timer && <TimerItem t={timer} />}
      {now.alerts.map((a) => (
        <Link key={a.text} href={a.href} className="inline-flex items-center gap-2 whitespace-nowrap hover:underline">
          <i aria-hidden className={a.kind === "due" ? "size-2 bg-warn" : "size-2 rotate-45 bg-neg"} />
          <span className="sr-only">{a.kind === "due" ? "Due:" : a.kind === "over" ? "Over:" : "Overdue:"}</span>
          {a.text}
        </Link>
      ))}
    </div>
  );
}

function TimerItem({ t }: { t: NowTimer }) {
  const secs = useElapsed(t.started_at, t.paused_seconds, t.paused_at);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Link href={`/projects/cards/${t.card_id}/`} className="inline-flex items-center gap-2 hover:underline">
        <i aria-hidden className={`size-2 rounded-full ${t.paused_at ? "bg-field" : "bg-live"}`} />
        {t.paused_at ? "Paused" : "Tracking"} <b className="num">{h}:{String(m).padStart(2, "0")}</b> · {t.title}
      </Link>
      <button onClick={() => router.post("/projects/timer/stop/", {}, { preserveScroll: true })}
        className="ml-1 border border-line px-1.5 text-[11px] font-semibold hover:border-text" aria-label={`Stop the timer on ${t.title}`}>
        Stop
      </button>
    </span>
  );
}

function FocusItem({ f, serverNow }: { f: NowFocus; serverNow: string }) {
  const left = useCountdown(f.remaining_seconds, serverNow, f.paused);
  const label = f.phase === "focus" ? "Focus" : "Break";
  return (
    <Link href="/focus/" className="inline-flex items-center gap-2 whitespace-nowrap hover:underline">
      <i aria-hidden className={`size-2 rounded-full ${f.paused ? "bg-field" : "bg-live"}`} />
      {label} <b className="num">{formatMs(left)}</b>{f.tag ? ` · ${f.tag}` : ""}
    </Link>
  );
}
