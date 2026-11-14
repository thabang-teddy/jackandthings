<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\HistoryEntry;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Deletes history entries older than the configured retention window.
 *
 * PLACEHOLDER RULE: the retention window in config/history.php is a safe default,
 * not a confirmed product decision — the real auto-delete rule (schedule, which
 * browsers/profiles, per-domain exceptions) is still an open question in
 * docs/PRD.md. Revisit this command once that rule is settled.
 *
 * Runs system-wide rather than per user: it is a trusted scheduled job, so it
 * operates outside the policy layer that guards user-facing requests.
 */
class PruneHistoryEntries extends Command
{
    protected $signature = 'history:prune {--days= : Override the configured retention window}';

    protected $description = 'Delete browsing history entries older than the retention window';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('history.retention_days'));

        if ($days < 1) {
            $this->error('Retention window must be at least 1 day.');

            return self::FAILURE;
        }

        $cutoff = Carbon::now()->subDays($days);

        $deleted = HistoryEntry::query()
            ->where('visited_at', '<', $cutoff)
            ->delete();

        $this->info(sprintf(
            'Deleted %d history %s visited before %s (%d-day window).',
            $deleted,
            $deleted === 1 ? 'entry' : 'entries',
            $cutoff->toDateTimeString(),
            $days,
        ));

        return self::SUCCESS;
    }
}
