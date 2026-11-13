<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\PomodoroPhase;
use App\Models\PomodoroPreset;
use App\Models\PomodoroSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Logging a finished interval, and the guards on it.
 *
 * The client supplies the timestamps rather than the server stamping now(),
 * because a client can be offline when an interval ends and post it later -
 * the Android app does exactly that. That is a deliberate loosening, so the
 * bounds around it are worth pinning: nothing may be claimed to have
 * finished in the future, and nothing may run longer than any preset could
 * define.
 */
class PomodoroSessionContractTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
        Carbon::setTestNow(Carbon::parse('2026-11-13 12:00:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'preset_name' => 'Classic 25/5',
            'phase' => PomodoroPhase::Focus->value,
            'started_at' => '2026-11-13T11:30:00+00:00',
            'ended_at' => '2026-11-13T11:55:00+00:00',
            'duration_seconds' => 1500,
            'completed' => true,
            ...$overrides,
        ];
    }

    public function test_a_finished_interval_round_trips(): void
    {
        $session = $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'tag' => 'Coding',
            'source' => 'android',
        ]))->assertCreated()->json('data');

        $this->assertSame('Classic 25/5', $session['preset_name']);
        $this->assertSame('focus', $session['phase']);
        $this->assertSame(1500, $session['duration_seconds']);
        $this->assertSame('Coding', $session['tag']);
        $this->assertSame('android', $session['source']);
        $this->assertTrue($session['completed']);
    }

    public function test_an_interval_cannot_be_claimed_to_finish_in_the_future(): void
    {
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'started_at' => '2026-11-13T12:30:00+00:00',
            'ended_at' => '2026-11-13T12:55:00+00:00',
        ]))->assertStatus(422)->assertJsonValidationErrors('ended_at');
    }

    public function test_a_small_clock_skew_is_tolerated_rather_than_refused(): void
    {
        // A phone a couple of minutes ahead of the server is ordinary, and
        // throwing its sessions away would be worse than accepting them.
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'started_at' => '2026-11-13T11:37:00+00:00',
            'ended_at' => '2026-11-13T12:02:00+00:00',
        ]))->assertCreated();
    }

    public function test_an_interval_must_end_after_it_starts(): void
    {
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'started_at' => '2026-11-13T11:55:00+00:00',
            'ended_at' => '2026-11-13T11:30:00+00:00',
        ]))->assertStatus(422)->assertJsonValidationErrors('started_at');
    }

    public function test_an_implausibly_long_interval_is_refused(): void
    {
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'duration_seconds' => 60 * 60 * 24,
        ]))->assertStatus(422)->assertJsonValidationErrors('duration_seconds');
    }

    public function test_a_phase_the_server_does_not_know_is_refused(): void
    {
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload(['phase' => 'napping']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('phase');
    }

    public function test_all_three_phases_are_accepted(): void
    {
        foreach (PomodoroPhase::cases() as $phase) {
            $this->postJson('/api/v1/pomodoro-sessions', $this->payload(['phase' => $phase->value]))
                ->assertCreated();
        }

        $this->assertSame(3, $this->user->pomodoroSessions()->count());
    }

    public function test_a_session_cannot_be_attributed_to_another_users_preset(): void
    {
        $stranger = User::factory()->create();
        $theirs = PomodoroPreset::factory()->for($stranger)->create();

        // The exists rule is scoped to the caller, so this reads as "no such
        // preset" rather than confirming somebody else's record exists.
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'pomodoro_preset_id' => $theirs->getKey(),
        ]))->assertStatus(422)->assertJsonValidationErrors('pomodoro_preset_id');
    }

    public function test_a_session_may_carry_no_preset_at_all(): void
    {
        // A preset deleted mid-session, or one created offline whose id the
        // server has never seen. The name still carries the label.
        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'pomodoro_preset_id' => null,
        ]))->assertCreated();
    }

    public function test_deleting_a_preset_leaves_its_sessions_behind(): void
    {
        $preset = PomodoroPreset::factory()->for($this->user)->create(['name' => 'Classic 25/5']);

        $this->postJson('/api/v1/pomodoro-sessions', $this->payload([
            'pomodoro_preset_id' => $preset->getKey(),
        ]))->assertCreated();

        $this->deleteJson("/api/v1/pomodoro-presets/{$preset->id}")->assertNoContent();

        // Last month's focus hours must not vanish because a preset was
        // tidied up, which is why preset_name is denormalised.
        $session = $this->user->pomodoroSessions()->sole();
        $this->assertNull($session->pomodoro_preset_id);
        $this->assertSame('Classic 25/5', $session->preset_name);
    }

    public function test_there_is_no_way_to_edit_a_recorded_interval(): void
    {
        $session = PomodoroSession::factory()->for($this->user)->create();

        // A recorded interval is history; the only honest correction is to
        // remove it, so no update route exists to find.
        $this->putJson("/api/v1/pomodoro-sessions/{$session->id}", ['duration_seconds' => 99])
            ->assertStatus(405);
    }

    public function test_the_list_can_be_limited_and_windowed(): void
    {
        PomodoroSession::factory()->for($this->user)->count(3)->create([
            'started_at' => Carbon::parse('2026-11-13 09:00:00', 'UTC'),
            'ended_at' => Carbon::parse('2026-11-13 09:25:00', 'UTC'),
        ]);
        PomodoroSession::factory()->for($this->user)->create([
            'started_at' => Carbon::parse('2026-11-01 09:00:00', 'UTC'),
            'ended_at' => Carbon::parse('2026-11-01 09:25:00', 'UTC'),
        ]);

        $this->getJson('/api/v1/pomodoro-sessions?limit=2')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/pomodoro-sessions?since=2026-11-10')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_the_stats_endpoint_buckets_in_the_zone_it_is_given(): void
    {
        $stats = $this->getJson('/api/v1/pomodoro-sessions/stats?tz=Africa/Johannesburg')
            ->assertOk()
            ->json('data');

        $this->assertSame('Africa/Johannesburg', $stats['timezone']);
        $this->assertArrayHasKey('today', $stats);
        $this->assertCount(7, $stats['days']);
        $this->assertCount(24, $stats['hours']);
    }

    public function test_stats_is_not_swallowed_by_the_show_route(): void
    {
        // "stats" would otherwise bind as a session id. Declared first in
        // routes/api.php for exactly this reason.
        $this->getJson('/api/v1/pomodoro-sessions/stats')->assertOk();
    }

    public function test_a_nonsense_timezone_is_refused_rather_than_silently_ignored(): void
    {
        $this->getJson('/api/v1/pomodoro-sessions/stats?tz=Mars/Olympus_Mons')
            ->assertStatus(422)
            ->assertJsonValidationErrors('tz');
    }

    public function test_a_signed_out_client_reaches_none_of_it(): void
    {
        app('auth')->forgetGuards();

        $this->postJson('/api/v1/pomodoro-sessions', $this->payload())->assertUnauthorized();
        $this->getJson('/api/v1/pomodoro-sessions')->assertUnauthorized();
        $this->getJson('/api/v1/pomodoro-sessions/stats')->assertUnauthorized();
    }
}
