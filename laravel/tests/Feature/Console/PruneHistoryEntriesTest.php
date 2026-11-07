<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use App\Models\HistoryEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * history:prune actually deletes, and only what it should.
 *
 * The retention window itself is a placeholder rather than an approved rule
 * (see docs/PRD.md), so what is pinned here is the mechanism: the cut-off is
 * respected, the job is system-wide, and a nonsensical window is refused
 * rather than interpreted.
 */
class PruneHistoryEntriesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-11-07 12:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function entryVisited(string $when, ?User $owner = null): HistoryEntry
    {
        return ($owner ?? $this->user)->historyEntries()->create([
            'url' => 'https://example.test/'.md5($when),
            'visited_at' => Carbon::parse($when),
            'source' => 'seed',
        ]);
    }

    public function test_it_deletes_entries_older_than_the_window_and_keeps_the_rest(): void
    {
        $stale = $this->entryVisited('2026-01-01 09:00:00');   // ~310 days old
        $fresh = $this->entryVisited('2026-11-01 09:00:00');   // 6 days old

        $this->artisan('history:prune')->assertExitCode(0);

        $this->assertDatabaseMissing('history_entries', ['id' => $stale->id]);
        $this->assertDatabaseHas('history_entries', ['id' => $fresh->id]);
    }

    public function test_an_entry_just_inside_the_window_survives(): void
    {
        // 90 days is the default, so 89 days ago must stay and 91 must go.
        $inside = $this->entryVisited(Carbon::now()->subDays(89)->toDateTimeString());
        $outside = $this->entryVisited(Carbon::now()->subDays(91)->toDateTimeString());

        $this->artisan('history:prune')->assertExitCode(0);

        $this->assertDatabaseHas('history_entries', ['id' => $inside->id]);
        $this->assertDatabaseMissing('history_entries', ['id' => $outside->id]);
    }

    public function test_the_days_option_overrides_the_configured_window(): void
    {
        $entry = $this->entryVisited(Carbon::now()->subDays(10)->toDateTimeString());

        // Untouched by the 90-day default, removed by a 7-day window.
        $this->artisan('history:prune')->assertExitCode(0);
        $this->assertDatabaseHas('history_entries', ['id' => $entry->id]);

        $this->artisan('history:prune', ['--days' => 7])->assertExitCode(0);
        $this->assertDatabaseMissing('history_entries', ['id' => $entry->id]);
    }

    public function test_a_window_below_one_day_is_refused_rather_than_deleting_everything(): void
    {
        $entry = $this->entryVisited(Carbon::now()->subDays(400)->toDateTimeString());

        $this->artisan('history:prune', ['--days' => 0])->assertExitCode(1);

        $this->assertDatabaseHas('history_entries', ['id' => $entry->id]);
    }

    public function test_it_prunes_for_every_user_because_it_runs_outside_the_policy_layer(): void
    {
        $other = User::factory()->create();
        $mine = $this->entryVisited('2026-01-01 09:00:00');
        $theirs = $this->entryVisited('2026-01-02 09:00:00', $other);

        $this->artisan('history:prune')->assertExitCode(0);

        $this->assertDatabaseMissing('history_entries', ['id' => $mine->id]);
        $this->assertDatabaseMissing('history_entries', ['id' => $theirs->id]);
    }

    public function test_it_is_registered_to_run_daily(): void
    {
        // The schedule is the only thing making this automatic, so losing the
        // entry would quietly stop every clean-up.
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->filter(fn ($event) => str_contains($event->command ?? '', 'history:prune'));

        $this->assertCount(1, $events, 'history:prune is not on the schedule');
        $this->assertSame('0 0 * * *', $events->first()->expression);
    }
}
