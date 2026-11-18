import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import { dueText, todayIso } from "@/lib/dates";
import { formatDuration } from "@/lib/time";

export type BoardCard = {
  id: number; title: string; project: { id: number; name: string; colour: string }; due_date: string | null;
  notes: number; tracked_seconds: number; running: boolean; done: boolean; column_id?: number;
};
export type BoardColumn = { key: string; name: string; wip_limit?: number | null; cards: BoardCard[] };

type Props = {
  columns: BoardColumn[];
  /** Which real column id a card should move to when dropped on `column` (null = not allowed). */
  targetFor: (card: BoardCard, column: BoardColumn) => number | null;
  /** "Move to…" choices for a card: real columns of its own project. */
  moveOptions: (card: BoardCard) => { id: number; name: string }[];
  showProject?: boolean;
  footer?: (column: BoardColumn) => React.ReactNode;
};

const move = (cardId: number, columnId: number, position: number) =>
  router.post(`/projects/cards/${cardId}/move/`, { column_id: columnId, position }, { preserveScroll: true });

/** Native HTML5 drag and drop, plus a "Move to…" menu on every card so the keyboard works too. */
export function Kanban({ columns, targetFor, moveOptions, showProject, footer }: Props) {
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = todayIso();

  const drop = (column: BoardColumn, index: number) => {
    if (!dragging) return;
    const target = targetFor(dragging, column);
    setDragging(null);
    setOver(null);
    if (target !== null) move(dragging.id, target, index);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-4">
        {columns.map((col) => {
          const full = col.wip_limit ? col.cards.length >= col.wip_limit : false;
          const allowed = dragging ? targetFor(dragging, col) !== null : true;
          return (
            <section key={col.key} aria-label={`${col.name}, ${col.cards.length} cards`}
              onDragOver={(e) => { if (dragging && allowed) { e.preventDefault(); setOver(col.key); } }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(col, col.cards.length); }}
              className={`flex w-[280px] shrink-0 flex-col border-t-2 bg-surface p-3 ${over === col.key ? "border-accent bg-tint" : "border-text"} ${dragging && !allowed ? "opacity-50" : ""}`}>
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{col.name}</h2>
                <span className={`num text-[12px] ${full ? "font-bold text-warn" : "text-muted"}`}>
                  {col.cards.length}{col.wip_limit ? ` / ${col.wip_limit}` : ""}
                </span>
              </header>
              <ol className="grid gap-2">
                {col.cards.map((card, index) => (
                  <li key={card.id} draggable onDragStart={(e) => { setDragging(card); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onDragOver={(e) => { if (dragging && allowed) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col, index); }}
                    className={`cursor-grab border border-line bg-surface2 p-3 active:cursor-grabbing ${dragging?.id === card.id ? "opacity-40" : ""}`}>
                    <CardTile card={card} showProject={showProject} today={today} index={index}
                      options={moveOptions(card)} column={col} />
                  </li>
                ))}
              </ol>
              {col.cards.length === 0 && <p className="py-6 text-center text-[13px] text-muted">Drop cards here</p>}
              {footer?.(col)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CardTile({ card, showProject, today, options, column, index }:
  { card: BoardCard; showProject?: boolean; today: string; options: { id: number; name: string }[]; column: BoardColumn; index: number }) {
  const overdue = card.due_date && !card.done && card.due_date < today;
  return (
    <div className="grid gap-2">
      {showProject && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <i aria-hidden className="size-2 rounded-full" style={{ background: card.project.colour }} />{card.project.name}
        </p>
      )}
      <Link href={`/projects/cards/${card.id}/`} className={`font-medium leading-snug hover:underline ${card.done ? "text-muted line-through" : ""}`}>
        {card.title}
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        {card.running && <span className="inline-flex items-center gap-1 font-semibold text-live-ink"><i aria-hidden className="size-2 rounded-full bg-live" />Tracking</span>}
        {card.due_date && !card.done && <span className={overdue ? "font-semibold text-neg" : ""}>{dueText(card.due_date, today)}</span>}
        {card.notes > 0 && <span>{card.notes} note{card.notes === 1 ? "" : "s"}</span>}
        {card.tracked_seconds > 0 && <span className="num">{formatDuration(card.tracked_seconds)}</span>}
      </div>
      <label className="sr-only" htmlFor={`move-${card.id}`}>Move “{card.title}” to</label>
      <select id={`move-${card.id}`} value="" onChange={(e) => {
          const v = e.target.value;
          if (v === "up" || v === "down") {
            const target = card.column_id ?? options.find((o) => o.name === column.name)?.id;
            if (target) move(card.id, target, Math.max(0, index + (v === "up" ? -1 : 1)));
          } else if (v) move(card.id, Number(v), 0);
        }}
        className="h-7 w-full border border-line bg-surface2 text-[12px] text-muted">
        <option value="">Move to…</option>
        <option value="up">↑ Up one</option>
        <option value="down">↓ Down one</option>
        {options.filter((o) => o.name !== column.name).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
