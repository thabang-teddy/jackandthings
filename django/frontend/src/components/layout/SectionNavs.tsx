import { SubNav } from "@/components/ui/Tabs";

export const FocusNav = () => (
  <SubNav label="Focus" items={[
    { href: "/focus/", label: "Timer", exact: true }, { href: "/focus/presets/", label: "Presets" },
    { href: "/focus/sessions/", label: "History" }, { href: "/focus/stats/", label: "Stats" }]} />
);

export const ProjectsNav = () => (
  <SubNav label="Projects" items={[
    { href: "/projects/", label: "All boards", exact: true }, { href: "/projects/calendar/", label: "Calendar" },
    { href: "/projects/time/", label: "Time" }]} />
);

export const MoneyNav = () => (
  <SubNav label="Money" items={[
    { href: "/money/", label: "Overview", exact: true }, { href: "/money/transactions/", label: "Transactions" },
    { href: "/money/accounts/", label: "Accounts" }, { href: "/money/transfer/", label: "Move money" },
    { href: "/money/categories/", label: "Categories" }, { href: "/money/caps/", label: "Caps" },
    { href: "/money/goals/", label: "Goals" }, { href: "/money/recurring/", label: "Recurring" },
    { href: "/money/reports/", label: "Reports" }]} />
);

export const TrainingNav = () => (
  <SubNav label="Training" items={[
    { href: "/training/", label: "Today", exact: true }, { href: "/training/routines/", label: "Routines" },
    { href: "/training/exercises/", label: "Exercises" }, { href: "/training/sessions/", label: "History" },
    { href: "/training/body/", label: "Body" }, { href: "/training/stats/", label: "Stats" }]} />
);

export const LibraryNav = () => (
  <SubNav label="Library" items={[
    { href: "/library/", label: "Watch list", exact: true }, { href: "/library/history/", label: "History" }]} />
);
