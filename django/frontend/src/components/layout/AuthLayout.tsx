import { Link } from "@inertiajs/react";
import type { ReactNode } from "react";
import { Toasts } from "@/components/ui/Toasts";

/** Signed-out screens: no shell, just the wordmark and a narrow column. */
export function AuthLayout({ title, deck, children }: { title: string; deck?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-md items-center px-4 pt-10">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">Jack &amp; Things</Link>
      </header>
      <main id="main" className="mx-auto grid max-w-md gap-5 px-4 py-12">
        <div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">{title}</h1>
          {deck && <p className="mt-2 text-[15px] text-muted">{deck}</p>}
        </div>
        {children}
      </main>
      <Toasts />
    </div>
  );
}
