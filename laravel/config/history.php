<?php

declare(strict_types=1);

return [
    /*
     * PLACEHOLDER pending product confirmation.
     *
     * See docs/PRD.md "Open decisions" ("History auto-delete rule: schedule,
     * which browsers/profiles, any per-domain exceptions") and docs/DATABASE.md
     * HistoryEntry retention ("Unresolved").
     *
     * This 90-day default is NOT an approved product rule. It exists only so
     * `history:prune` has a safe, overridable number to run against until the
     * real rule is confirmed. Do not present this value as a settled decision
     * in UI copy, documentation, or support answers.
     */
    'retention_days' => (int) env('HISTORY_RETENTION_DAYS', 90),
];
