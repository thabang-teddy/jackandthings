import { usePage } from "@inertiajs/react";

export type Flash = { level?: string; tags?: string; message: string };

/** inertia-django puts Django messages under `flash.messages`. Confirm the exact path in your
 *  browser: console.log(usePage()) once, then delete the fallback you don't need. */
export function useFlash(): Flash[] {
  const page = usePage() as unknown as { flash?: { messages?: Flash[] }; props: { flash?: { messages?: Flash[] } } };
  return page.flash?.messages ?? page.props.flash?.messages ?? [];
}

export const isError = (f: Flash) => (f.tags ?? f.level ?? "").includes("error");
