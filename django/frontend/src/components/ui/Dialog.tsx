import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog>: showModal() traps focus, Esc closes it, and the page behind becomes inert. */
export function Dialog({ open, title, onClose, children, tone = "accent", wide }:
  { open: boolean; title: string; onClose: () => void; children: ReactNode; tone?: "accent" | "neg"; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-32px)] ${wide ? "max-w-[640px]" : "max-w-[480px]"} border-t-[3px] bg-surface2 p-6 text-text shadow-[0_18px_40px_-18px_rgb(23_25_30/.35)] ${tone === "neg" ? "border-neg" : "border-accent"}`}>
      <h2 id="dialog-title" className="mb-3 font-serif text-2xl font-medium">{title}</h2>
      {open && children}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose }:
  { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={open} title={title} onClose={onClose} tone="neg">
      <div className="text-[14.5px]">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        {/* autoFocus on Cancel: the design rule for destructive confirms */}
        <button autoFocus onClick={onClose} className="h-10 px-4 font-semibold">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="h-10 rounded-[3px] bg-neg px-4 font-semibold text-bg">{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
