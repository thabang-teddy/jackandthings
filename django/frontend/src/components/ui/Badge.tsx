import type { ReactNode } from "react";

const tones = {
  neutral: "bg-tint text-text",
  pos: "bg-pos-tint text-pos",
  neg: "bg-neg-tint text-neg",
  warn: "bg-warn-tint text-warn",
  live: "bg-live-tint text-live-ink",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex h-[22px] items-center rounded-[3px] px-2 text-[12px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** A coloured square with a letter (categories) or a dot (projects). */
export function Swatch({ colour, glyph, size = 22 }: { colour: string; glyph?: string; size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-[3px] text-[11px] font-bold text-white"
      style={{ background: colour, width: size, height: size }}>{glyph}</span>
  );
}
