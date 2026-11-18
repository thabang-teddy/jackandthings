import { useEffect, useState } from "react";
import { isError, useFlash, type Flash } from "@/lib/flash";

type Toast = Flash & { key: number };
let counter = 0;

/** Shows Django messages. Auto-hides after 6 s; error toasts stay until dismissed. */
export function Toasts() {
  const flash = useFlash();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!flash.length) return;
    setToasts((t) => [...t, ...flash.map((f) => ({ ...f, key: ++counter }))].slice(-4));
  }, [flash]);

  useEffect(() => {
    const timers = toasts.filter((t) => !isError(t)).map((t) =>
      window.setTimeout(() => setToasts((all) => all.filter((x) => x.key !== t.key)), 6000));
    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div key={t.key} role={isError(t) ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-[520px] items-start gap-3 border-l-[3px] bg-prim px-4 py-3 text-[14px] text-prim-ink shadow-lg ${isError(t) ? "border-neg" : "border-live"}`}>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setToasts((all) => all.filter((x) => x.key !== t.key))} aria-label="Dismiss"
            className="-my-1 px-1 text-lg leading-none opacity-70 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}
