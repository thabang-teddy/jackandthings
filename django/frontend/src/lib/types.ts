/** Shapes shared by many pages. They mirror the dicts the Python selectors build. */

export type Errors = Record<string, string | undefined>;

export type Paged<T> = { items: T[]; page: number; pages: number; total: number };

export type Option = { value: string; label: string };
export type IdName = { id: number; name: string };

export type User = { id: number; name: string; email: string; email_verified: boolean; theme: Theme };
export type Theme = "system" | "light" | "dark";

export type NowTimer = {
  card_id: number; title: string; project: string; started_at: string; paused_seconds: number; paused_at: string | null;
};
export type NowFocus = { phase: string; tag: string; remaining_seconds: number; paused: boolean; ends_at: string };
export type NowAlert = { kind: "over" | "overdue" | "due"; text: string; href: string };
export type Now = { server_now: string; timer: NowTimer | null; focus: NowFocus | null; alerts: NowAlert[] };

/** Props every page receives from InertiaShareMiddleware. */
export type SharedProps = {
  auth: { user: User | null };
  now: Now | null;
  app: { debug: boolean };
  errors?: Errors;
};
