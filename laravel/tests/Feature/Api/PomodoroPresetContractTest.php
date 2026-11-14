<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\PomodoroPreset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The preset payload, which three clients decode.
 *
 * Issue #3 took a preset from four fields to fourteen, and the compatibility
 * case is the one that matters most here: an Android build or an add-on copy
 * that has not been updated still posts the old four, and must keep working
 * against the one shared api/v1 contract. Every column added has a default
 * behind it precisely so that holds, and this is what proves it.
 */
class PomodoroPresetContractTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
    }

    public function test_the_four_field_payload_an_older_client_sends_still_works(): void
    {
        $preset = $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Deep work',
            'focus_minutes' => 50,
            'break_minutes' => 10,
            'is_default' => false,
        ])->assertCreated()->json('data');

        $this->assertSame(50, $preset['focus_minutes']);
        // The fields that client has never heard of come back filled in,
        // reproducing what the timer did before issue #3: a long break every
        // fourth run, breaks rolling on by themselves, work waiting for you.
        $this->assertSame(15, $preset['long_break_minutes']);
        $this->assertSame(4, $preset['cycles_before_long_break']);
        $this->assertTrue($preset['auto_start_breaks']);
        $this->assertFalse($preset['auto_start_focus']);
        $this->assertFalse($preset['strict_mode']);
        $this->assertSame([], $preset['blocked_sites']);
    }

    public function test_only_a_name_and_a_focus_length_are_actually_required(): void
    {
        $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Sprint',
            'focus_minutes' => 20,
        ])->assertCreated();

        $this->postJson('/api/v1/pomodoro-presets', ['focus_minutes' => 20])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');

        $this->postJson('/api/v1/pomodoro-presets', ['name' => 'No length'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('focus_minutes');
    }

    public function test_every_field_round_trips(): void
    {
        $payload = [
            'name' => 'Everything',
            'focus_minutes' => 45,
            'break_minutes' => 7,
            'long_break_minutes' => 25,
            'cycles_before_long_break' => 3,
            'auto_start_breaks' => false,
            'auto_start_focus' => true,
            'tag' => 'Studying',
            'alarm_sound' => 'bell',
            'ticking_sound' => 'soft',
            'ambience' => 'rain',
            'strict_mode' => true,
            'blocked_sites' => ['news.ycombinator.com', '*.reddit.com'],
            'is_default' => true,
        ];

        $preset = $this->postJson('/api/v1/pomodoro-presets', $payload)
            ->assertCreated()
            ->json('data');

        foreach ($payload as $field => $expected) {
            $this->assertSame($expected, $preset[$field], "[$field] did not survive the round trip");
        }

        // And the same shape comes back out of the index, not just the create.
        $this->assertSame($preset, $this->getJson('/api/v1/pomodoro-presets')->json('data.0'));
    }

    public function test_a_sound_the_server_does_not_know_is_refused(): void
    {
        $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Bad sound',
            'focus_minutes' => 25,
            'alarm_sound' => 'airhorn',
        ])->assertStatus(422)->assertJsonValidationErrors('alarm_sound');
    }

    public function test_a_blocked_site_must_be_a_hostname_not_a_url(): void
    {
        // The add-on matches these against a request's hostname, so a scheme
        // or a path would never match and is better refused than ignored.
        $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Strict',
            'focus_minutes' => 25,
            'blocked_sites' => ['https://news.ycombinator.com/item?id=1'],
        ])->assertStatus(422)->assertJsonValidationErrors('blocked_sites.0');
    }

    public function test_a_preset_can_be_updated_in_place(): void
    {
        $preset = PomodoroPreset::factory()->for($this->user)->create(['name' => 'Before']);

        $updated = $this->putJson("/api/v1/pomodoro-presets/{$preset->id}", [
            'name' => 'After',
            'focus_minutes' => 30,
            'ambience' => 'cafe',
        ])->assertOk()->json('data');

        $this->assertSame('After', $updated['name']);
        $this->assertSame('cafe', $updated['ambience']);
    }

    public function test_only_one_preset_is_ever_the_default(): void
    {
        $first = $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'First', 'focus_minutes' => 25, 'is_default' => true,
        ])->json('data');

        $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Second', 'focus_minutes' => 25, 'is_default' => true,
        ])->assertCreated();

        $this->assertFalse(PomodoroPreset::findOrFail($first['id'])->is_default);
        $this->assertSame(1, $this->user->pomodoroPresets()->where('is_default', true)->count());
    }

    public function test_one_users_default_does_not_clear_anothers(): void
    {
        $stranger = User::factory()->create();
        $theirs = PomodoroPreset::factory()->for($stranger)->create(['is_default' => true]);

        $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Mine', 'focus_minutes' => 25, 'is_default' => true,
        ])->assertCreated();

        $this->assertTrue($theirs->fresh()->is_default);
    }

    public function test_user_id_cannot_be_set_from_the_body(): void
    {
        $stranger = User::factory()->create();

        $created = $this->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Theirs?',
            'focus_minutes' => 25,
            'user_id' => $stranger->getKey(),
        ])->assertCreated()->json('data');

        $this->assertSame(
            $this->user->getKey(),
            PomodoroPreset::findOrFail($created['id'])->user_id,
        );
    }
}
