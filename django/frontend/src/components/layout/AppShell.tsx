import { Link, router, usePage } from "@inertiajs/react";
import { useEffect, type ReactNode } from "react";
import { Toasts } from "@/components/ui/Toasts";
import type { SharedProps } from "@/lib/types";
import { NowLine } from "./NowLine";

const SECTIONS = [
  { href: "/", label: "Today", short: "Today" },
  { href: "/focus/", label: "Focus", short: "Focus" },
  { href: "/projects/", label: "Projects", short: "Projects" },
  { href: "/notes/", label: "Notes", short: "Notes" },
  { href: "/money/", label: "Money", short: "Money" },
  { href: "/training/", label: "Training", short: "Train" },
  { href: "/library/", label: "Library", short: "Library" },
  { href: "/settings/", label: "Settings", short: "Settings" },
];
const MOBILE = ["/", "/focus/", "/projects/", "/money/", "/notes/"];

const isActive = (url: string, href: string) => (href === "/" ? url === "/" || url.startsWith("/?") : url.startsWith(href));

const dateline = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** The persistent layout: it doesn't re-mount between pages, so the Now line's clocks keep ticking. */
export function AppShell({ children }: { children: ReactNode }) {
  const page = usePage();
  const { auth } = page.props as unknown as SharedProps;
  const url = page.url;

  // Keep <html data-theme> in step with the saved choice (Settings updates it instantly too).
  useEffect(() => {
    if (auth.user) document.documentElement.dataset.theme = auth.user.theme;
  }, [auth.user?.theme]);

  return (
    <div className="min-h-screen bg-bg pb-20 md:pb-0">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1360px] items-center gap-4 px-4 py-4 md:px-10">
          <Link href="/" className="font-serif text-xl font-semibold tracking-tight">Jack &amp; Things</Link>
          <p className="hidden text-[13px] text-muted lg:block">{dateline.format(new Date())}</p>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notes/new/" className="inline-flex h-9 items-center rounded-[3px] bg-prim px-3 text-[13px] font-semibold text-prim-ink hover:bg-accent hover:text-on-accent">
              + Capture
            </Link>
            {auth.user && (
              <details className="relative">
                <summary aria-label="Account menu" className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-line text-[13px] font-semibold">
                  {auth.user.name.slice(0, 1).toUpperCase()}
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 border border-line bg-surface2 p-2 text-sm shadow-lg">
                  <p className="truncate px-2 py-1.5 text-muted">{auth.user.email}</p>
                  <Link href="/settings/" className="block px-2 py-1.5 hover:bg-tint">Settings</Link>
                  <button onClick={() => router.post("/logout/")} className="block w-full px-2 py-1.5 text-left hover:bg-tint">Sign out</button>
                </div>
              </details>
            )}
          </div>
        </div>
        <nav aria-label="Sections" className="mx-auto hidden max-w-[1360px] px-4 md:block md:px-10">
          <ul className="flex gap-7">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} aria-current={isActive(url, s.href) ? "page" : undefined}
                  className={`inline-block border-b-2 pb-2.5 text-sm font-semibold ${isActive(url, s.href) ? "border-text" : "border-transparent text-muted hover:text-text"}`}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {auth.user && !auth.user.email_verified && <VerifyBanner />}
      <NowLine />
      <main id="main" className="mx-auto max-w-[1360px] px-4 py-8 md:px-10 md:py-10">{children}</main>
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <ul className="grid grid-cols-5">
          {SECTIONS.filter((s) => MOBILE.includes(s.href)).map((s) => (
            <li key={s.href}>
              <Link href={s.href} aria-current={isActive(url, s.href) ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center text-[11.5px] font-semibold ${isActive(url, s.href) ? "text-text" : "text-muted"}`}>
                <span aria-hidden className={`mb-1 h-0.5 w-6 ${isActive(url, s.href) ? "bg-text" : "bg-transparent"}`} />
                {s.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Toasts />
    </div>
  );
}

function VerifyBanner() {
  return (
    <div className="border-b border-line bg-warn-tint px-4 py-2 text-center text-[13px] md:px-10">
      Please verify your email — we sent you a link.{" "}
      <button onClick={() => router.post("/email/resend/")} className="font-semibold underline">Send it again</button>
    </div>
  );
}
