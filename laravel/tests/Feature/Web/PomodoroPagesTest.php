<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Enums\PomodoroPhase;
use App\Models\PomodoroPreset;
use App\Models\PomodoroSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The Pomodoro module's four pages, and the props each one promises.
 *
 * These are prop-name tests, which usually earn little - but this module
 * splits a page into four that share a timer, a session log and a partial
 * reload keyed by page name. A prop renamed on the server with the page left
 * alone fails silently in the browser: the figure simply stops updating.
 * That is the bug class this file exists for.
 *
 * The other half is the loading contract. Each page is supposed to query only
 * what it draws, so opening Presets runs no analytics; a page quietly growing
 * the others' props back is a regression nobody would otherwise notice.
 */
class PomodoroPagesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-11-13 10:00:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function logFocus(int $minutes = 25, array $overrides = []): PomodoroSession
    {
        $startedAt = Carbon::parse('2026-11-13 09:00:00', 'UTC');

        return $this->user->pomodoroSessions()->create([
            'preset_name' => 'Classic 25/5',
            'phase' => PomodoroPhase::Focus,
            'started_at' => $startedAt,
            'ended_at' => $startedAt->copy()->addMinutes($minutes),
            'duration_seconds' => $minutes * 60,
            'completed' => true,
            ...$overrides,
        ]);
    }

    // ── Timer ─────────────────────────────────────────────────────────────

    public function test_the_timer_page_carries_the_presets_and_todays_total(): void
    {
        PomodoroPreset::factory()->for($this->user)->create(['name' => 'Classic 25/5']);
        $this->logFocus();

        $this->actingAs($this->user)
            ->get(route('pomodoro.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Index')
                ->has('presets', 1)
                ->where('presets.0.name', 'Classic 25/5')
                ->where('today.focus_seconds', 1500)
                ->where('today.intervals', 1)
                ->has('timezone')
            );
    }

    public function test_the_timer_page_does_not_load_the_session_log_or_the_charts(): void
    {
        $this->logFocus();

        $this->actingAs($this->user)
            ->get(route('pomodoro.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Index')
                ->missing('analytics')
                ->missing('sessions')
            );
    }

    // ── Presets ───────────────────────────────────────────────────────────

    public function test_the_presets_page_carries_the_presets_and_the_tags_already_used(): void
    {
        PomodoroPreset::factory()->for($this->user)->create();
        $this->logFocus(25, ['tag' => 'Reading']);
        $this->logFocus(25, ['tag' => 'Coding']);
        $this->logFocus(25, ['tag' => 'Coding']);

        $this->actingAs($this->user)
            ->get(route('pomodoro.presets'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Presets')
                ->has('presets', 1)
                // Distinct and sorted, so the form offers each label once.
                ->where('tags', ['Coding', 'Reading'])
            );
    }

    public function test_the_presets_page_runs_no_analytics(): void
    {
        $this->actingAs($this->user)
            ->get(route('pomodoro.presets'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Presets')
                ->missing('analytics')
                ->missing('today')
                ->missing('sessions')
            );
    }

    // ── Sessions ──────────────────────────────────────────────────────────

    public function test_the_sessions_page_lists_intervals_newest_first(): void
    {
        $older = $this->logFocus();
        $newer = $this->logFocus(25, [
            'started_at' => Carbon::parse('2026-11-13 09:40:00', 'UTC'),
            'ended_at' => Carbon::parse('2026-11-13 10:05:00', 'UTC'),
        ]);

        $this->actingAs($this->user)
            ->get(route('pomodoro.sessions'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Sessions')
                ->has('sessions', 2)
                ->where('sessions.0.id', $newer->id)
                ->where('sessions.1.id', $older->id)
                ->has('today')
                ->has('timezone')
            );
    }

    public function test_the_sessions_page_never_shows_another_users_intervals(): void
    {
        $stranger = User::factory()->create();
        PomodoroSession::factory()->for($stranger)->create();

        $this->actingAs($this->user)
            ->get(route('pomodoro.sessions'))
            ->assertInertia(fn (Assert $page) => $page->has('sessions', 0));
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    public function test_the_stats_page_carries_the_whole_analytics_payload(): void
    {
        $this->logFocus();

        $this->actingAs($this->user)
            ->get(route('pomodoro.stats'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pomodoro/Stats')
                ->has('analytics', fn (Assert $analytics) => $analytics
                    ->where('today.focus_seconds', 1500)
                    ->has('days', 7)
                    ->has('hours', 24)
                    ->has('tags')
                    ->has('timezone')
                    ->has('week')
                    ->has('history')
                    ->has('streak_days')
                    ->has('completion_rate')
                    ->has('most_productive_hour')
                    ->has('break_seconds_today')
                    ->has('week_starts_on')
                    ->has('history_days')
                )
            );
    }

    public function test_every_page_buckets_in_the_timezone_the_page_asks_for(): void
    {
        $this->actingAs($this->user)
            ->get(route('pomodoro.stats', ['tz' => 'Africa/Johannesburg']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('analytics.timezone', 'Africa/Johannesburg'));

        $this->actingAs($this->user)
            ->get(route('pomodoro.index', ['tz' => 'Africa/Johannesburg']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('timezone', 'Africa/Johannesburg'));
    }

    public function test_a_nonsense_timezone_is_refused_rather_than_silently_ignored(): void
    {
        $this->actingAs($this->user)
            ->get(route('pomodoro.stats', ['tz' => 'Mars/Olympus_Mons']))
            ->assertSessionHasErrors('tz');
    }

    // ── Routing and redirects ─────────────────────────────────────────────

    public function test_the_page_paths_are_not_read_as_record_ids(): void
    {
        // "presets" and "sessions" share a path prefix with the write routes
        // that take a record id. Declared before them for this reason.
        $this->actingAs($this->user)->get('/pomodoro/presets')->assertOk();
        $this->actingAs($this->user)->get('/pomodoro/sessions')->assertOk();
        $this->actingAs($this->user)->get('/pomodoro/stats')->assertOk();
    }

    public function test_saving_a_preset_returns_to_the_presets_page_not_the_timer(): void
    {
        $this->actingAs($this->user)
            ->post(route('pomodoro.presets.store'), ['name' => 'New', 'focus_minutes' => 25])
            ->assertRedirect(route('pomodoro.presets'));
    }

    public function test_removing_a_session_returns_to_the_sessions_page(): void
    {
        $session = $this->logFocus();

        $this->actingAs($this->user)
            ->delete(route('pomodoro.sessions.destroy', $session->id))
            ->assertRedirect(route('pomodoro.sessions'));
    }

    /**
     * The page posts this from a timer callback, not a form submit. A
     * redirect would navigate the user to the Pomodoro page whenever an
     * interval ended while they were reading their notes.
     */
    public function test_logging_an_interval_answers_no_content_rather_than_redirecting(): void
    {
        $this->actingAs($this->user)
            ->post(route('pomodoro.sessions.store'), [
                'preset_name' => 'Classic 25/5',
                'phase' => 'focus',
                'started_at' => '2026-11-13T09:30:00+00:00',
                'ended_at' => '2026-11-13T09:55:00+00:00',
                'duration_seconds' => 1500,
            ])
            ->assertNoContent();

        $this->assertSame('web', $this->user->pomodoroSessions()->sole()->source);
    }

    public function test_a_signed_out_visitor_reaches_none_of_the_four_pages(): void
    {
        foreach (['pomodoro.index', 'pomodoro.presets', 'pomodoro.sessions', 'pomodoro.stats'] as $name) {
            $this->get(route($name))->assertRedirect(route('login'));
        }
    }
}
