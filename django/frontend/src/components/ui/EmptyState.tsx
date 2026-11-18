import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-xl">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-[14.5px] text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
