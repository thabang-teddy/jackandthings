import { Link } from "@inertiajs/react";

/** Previous / next links that keep the other query parameters (filters, search). */
export function Pager({ page, pages, total, noun = "items" }: { page: number; pages: number; total: number; noun?: string }) {
  if (pages <= 1) return <p className="mt-4 text-[13px] text-muted">{total} {noun}</p>;
  const href = (p: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    return `${window.location.pathname}?${params.toString()}`;
  };
  const cls = "inline-flex h-9 items-center border border-line px-3 text-sm font-semibold hover:border-text";
  return (
    <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-4">
      <p className="text-[13px] text-muted">Page {page} of {pages} · {total} {noun}</p>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className={cls} preserveScroll>← Newer</Link>}
        {page < pages && <Link href={href(page + 1)} className={cls} preserveScroll>Older →</Link>}
      </div>
    </nav>
  );
}
