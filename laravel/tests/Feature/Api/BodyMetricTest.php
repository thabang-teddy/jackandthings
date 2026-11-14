<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\BodyMetric;
use App\Models\ProgressPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A day's body figures. Integers throughout - grams, permille, millimetres -
 * so nothing is lost to rounding on the way in or out.
 */
class BodyMetricTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
    }

    public function test_a_reading_is_stored_as_integers(): void
    {
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'weight_grams' => 82_400,
            // 17.5% arrives as 175, so the half percent survives.
            'body_fat_permille' => 175,
            'measurements' => ['waist' => 860],
        ])->assertCreated()
            ->assertJsonPath('data.weight_grams', 82_400)
            ->assertJsonPath('data.body_fat_permille', 175)
            ->assertJsonPath('data.measurements.waist', 860);
    }

    public function test_a_second_reading_for_a_day_replaces_the_first(): void
    {
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'weight_grams' => 82_400,
        ])->assertCreated();

        // Weighing yourself twice in a morning is a correction, not a
        // unique-index violation.
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'weight_grams' => 82_100,
        ])->assertOk()->assertJsonPath('data.weight_grams', 82_100);

        $this->assertSame(1, BodyMetric::query()->count());
    }

    public function test_an_unknown_measurement_site_is_refused(): void
    {
        // A typo should be an error, not a key nothing ever reads again.
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'measurements' => ['waiste' => 860],
        ])->assertStatus(422)->assertJsonValidationErrors(['measurements.waiste']);
    }

    public function test_a_blank_site_is_dropped_rather_than_stored(): void
    {
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'measurements' => ['waist' => 860, 'chest' => null],
        ])->assertCreated()
            ->assertJsonPath('data.measurements', ['waist' => 860]);
    }

    public function test_a_reading_cannot_be_in_the_future(): void
    {
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => now()->addDays(3)->toDateString(),
            'weight_grams' => 82_000,
        ])->assertStatus(422)->assertJsonValidationErrors(['measured_on']);
    }

    public function test_an_absurd_weight_is_refused(): void
    {
        // 900 kg in grams: a unit mix-up, not a person.
        $this->postJson('/api/v1/body-metrics', [
            'measured_on' => '2026-11-14',
            'weight_grams' => 900_000,
        ])->assertStatus(422)->assertJsonValidationErrors(['weight_grams']);
    }

    public function test_the_list_shows_only_your_own_readings(): void
    {
        BodyMetric::factory()->for($this->user)->create();
        BodyMetric::factory()->for(User::factory()->create())->create();

        $this->getJson('/api/v1/body-metrics')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_deleting_a_reading_keeps_the_photos_taken_that_day(): void
    {
        $metric = BodyMetric::factory()->for($this->user)->create();
        $photo = ProgressPhoto::factory()
            ->for($this->user)
            ->create(['body_metric_id' => $metric->getKey()]);

        $this->deleteJson("/api/v1/body-metrics/{$metric->getKey()}")->assertNoContent();

        // Deleting a weigh-in must not silently destroy a photograph.
        $this->assertModelExists($photo);
        $this->assertNull($photo->fresh()->body_metric_id);
    }
}
