import { Link, usePage } from "@inertiajs/react";

/** Sub-navigation inside a section (Money: Overview / Transactions / …). */
export function SubNav({ items, label }: { items: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const url = usePage().url.split("?")[0];
  return (
    <nav aria-label={label} className="-mx-4 mb-8 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex gap-6 whitespace-nowrap">
        {items.map((i) => {
          const active = i.exact ? url === i.href : url.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 py-2.5 text-sm font-semibold ${active ? "border-text" : "border-transparent text-muted hover:text-text"}`}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
