import { useEffect, useMemo, useState } from "react";

/** Seconds elapsed on a server-side timer. The server is the source of truth; we only display. */
export function useElapsed(startedAt: string, pausedSeconds: number, pausedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (pausedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pausedAt]);
  const end = pausedAt ? Date.parse(pausedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000) - pausedSeconds);
}

/** Count down from a number the server measured at `serverNow`. Client clock skew doesn't matter. */
export function useCountdown(remainingAtLoad: number, serverNow: string, paused: boolean): number {
  // Remember when, by the client's clock, the server measured `remainingAtLoad`.
  const loadedAt = useMemo(() => Date.now(), [serverNow, remainingAtLoad]);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [paused]);
  return paused ? remainingAtLoad : Math.max(0, remainingAtLoad - Math.floor((tick - loadedAt) / 1000));
}

/** Seconds until an ISO time, measured against the server's clock at load. */
export function useSecondsUntil(untilIso: string | null, serverNow: string): number {
  const remaining = untilIso ? Math.max(0, Math.floor((Date.parse(untilIso) - Date.parse(serverNow)) / 1000)) : 0;
  return useCountdown(remaining, serverNow, !untilIso);
}

const two = (n: number) => String(n).padStart(2, "0");

export const formatHms = (s: number) => `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
export const formatMs = (s: number) => `${Math.floor(s / 60)}:${two(s % 60)}`;
/** 5400 → "1 h 30 min"; 900 → "15 min". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
