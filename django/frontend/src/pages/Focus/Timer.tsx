import { router, useForm } from "@inertiajs/react";
import { useEffect, useRef } from "react";
import { FocusNav } from "@/components/layout/SectionNavs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { chime } from "@/lib/sound";
import { formatMs, useCountdown } from "@/lib/time";
import { useStrictMode } from "@/lib/wakelock";

export type Preset = { id: number; name: string; focus_min: number; short_min: number; long_min: number; long_every: number;
  auto_start: "off" | "breaks" | "focus" | "both"; sound: string; strict: boolean; is_default: boolean };
type Running = { id: number; phase: "focus" | "short" | "long"; tag: string; cycle_index: number; started_at: string;
  planned_seconds: number; paused_at: string | null; paused_seconds: number; remaining_seconds: number; preset: string | null };
type Props = { presets: Preset[]; running: Running | null; next: { phase: string; cycle_index: number } | null;
  server_now: string; today_minutes: number };

const PHASE = { focus: "Focus", short: "Short break", long: "Long break" } as const;
const opts = { preserveScroll: true };

export default function FocusTimer({ presets, running, next, server_now, today_minutes }: Props) {
  return (
    <>
      <PageHeader kicker="Focus" title={running ? PHASE[running.phase] : "Ready when you are"}
        deck={`${today_minutes} minutes of focus today.`} />
      <FocusNav />
      {running ? <RunningTimer r={running} next={next} serverNow={server_now} presets={presets} />
        : <StartForm presets={presets} next={next} />}
    </>
  );
}

function StartForm({ presets, next }: { presets: Preset[]; next: Props["next"] }) {
  const def = presets.find((p) => p.is_default) ?? presets[0];
  const form = useForm({ preset_id: def ? String(def.id) : "", tag: "" });
  const chosen = presets.find((p) => String(p.id) === form.data.preset_id);
  return (
    <form className="grid max-w-lg gap-5" onSubmit={(e) => { e.preventDefault(); form.post("/focus/start/", opts); }}>
      <FormError errors={form.errors as Record<string, string>} />
      {next && (
        <Alert tone="success" title="Nice work.">
          <span className="mr-3">Up next: {PHASE[next.phase as keyof typeof PHASE]}.</span>
          <button type="button" className="font-semibold underline" onClick={() => router.post("/focus/next/", {}, opts)}>
            Start {PHASE[next.phase as keyof typeof PHASE].toLowerCase()} now
          </button>
        </Alert>
      )}
      <p className="num font-serif text-[120px] leading-none tracking-tight">{formatMs((chosen?.focus_min ?? 25) * 60)}</p>
      <Select label="Preset" value={form.data.preset_id} onChange={(v) => form.setData("preset_id", v)}
        options={presets.map((p) => ({ value: p.id, label: `${p.name} — ${p.focus_min}/${p.short_min}/${p.long_min}` }))}
        error={form.errors.preset_id} />
      <Field label="What are you working on?" placeholder="e.g. Writing" maxLength={40} value={form.data.tag}
        onChange={(v) => form.setData("tag", v)} error={form.errors.tag} hint="Optional. Tags group your stats." />
      <Button type="submit" size="lg" loading={form.processing}>Start focus</Button>
    </form>
  );
}

function RunningTimer({ r, next, serverNow, presets }: { r: Running; next: Props["next"]; serverNow: string; presets: Preset[] }) {
  const paused = r.paused_at !== null;
  const left = useCountdown(r.remaining_seconds, serverNow, paused);
  const preset = presets.find((p) => p.name === r.preset);
  const fired = useRef(false);
  useStrictMode(!!preset?.strict && r.phase === "focus" && !paused);

  // At zero: chime once and tell the server. The server decides what comes next.
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      chime(preset?.sound);
      router.post("/focus/skip/", {}, opts);
    }
  }, [left, preset?.sound]);

  useEffect(() => {
    document.title = `${formatMs(left)} · ${PHASE[r.phase]}`;
    return () => { document.title = "Jack & Things"; };
  }, [left, r.phase]);

  const pct = 100 - (left / r.planned_seconds) * 100;
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <p className="kicker">{PHASE[r.phase]} · cycle {r.cycle_index}{r.tag ? ` · ${r.tag}` : ""}</p>
        <p role="timer" aria-live="off" className={`num font-serif text-[120px] leading-none tracking-tight md:text-[168px] ${paused ? "text-muted" : ""}`}>
          {formatMs(left)}
        </p>
        <div className="mt-3 h-1.5 bg-line" aria-hidden><div className="h-full bg-live" style={{ width: `${pct}%` }} /></div>
      </div>
      {paused && <Alert tone="warn">Paused. Paused time doesn't count.</Alert>}
      {preset?.strict && r.phase === "focus" && (
        <p className="text-[13px] text-muted">This tab stays awake and asks before you leave. Blocking sites is the extension's job.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {paused ? <Button variant="live" onClick={() => router.post("/focus/resume/", {}, opts)}>Resume</Button>
          : <Button onClick={() => router.post("/focus/pause/", {}, opts)}>Pause</Button>}
        <Button variant="secondary" onClick={() => router.post("/focus/skip/", {}, opts)}>
          {r.phase === "focus" ? "Finish early (counts)" : "Skip break"}
        </Button>
        <Button variant="ghost" onClick={() => router.post("/focus/stop/", {}, opts)}>Stop (doesn't count)</Button>
      </div>
      {next && <p className="text-sm text-muted">Next: {PHASE[next.phase as keyof typeof PHASE]}{next.phase === "focus" ? ` (cycle ${next.cycle_index})` : ""}.</p>}
    </div>
  );
}
