<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\BodyMetric;
use App\Models\ProgressPhoto;
use App\Models\User;
use App\Services\ProgressPhotoStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The project's only file upload, and its most sensitive one.
 *
 * These are photographs of somebody's body. The tests below are written
 * against the ways this could leak rather than against the happy path alone:
 * a public URL, a guessable path, an executable extension, an unauthenticated
 * read, or a file left behind after the row is gone.
 */
class ProgressPhotoTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(ProgressPhotoStorage::DISK);

        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
    }

    public function test_an_image_can_be_uploaded_and_is_stored_privately(): void
    {
        $response = $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('front.jpg', 400, 600),
            'taken_on' => '2026-11-14',
            'caption' => 'Week 6',
        ])->assertCreated();

        $photo = ProgressPhoto::query()->firstOrFail();

        Storage::disk(ProgressPhotoStorage::DISK)->assertExists($photo->path);

        // Never the public disk, which would make the file reachable without
        // passing an authorization check at all.
        $this->assertSame('local', $photo->disk);
        $this->assertStringStartsWith("progress-photos/{$this->user->getKey()}/", $photo->path);

        // The wire shape must not say where the file lives on the server.
        $response->assertJsonMissingPath('data.path');
        $response->assertJsonMissingPath('data.disk');
    }

    public function test_the_stored_name_is_random_and_not_the_clients(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('selfie.php.jpg'),
            'taken_on' => '2026-11-14',
        ])->assertCreated();

        $photo = ProgressPhoto::query()->firstOrFail();

        // The extension comes from the validated mime type, so an uploaded
        // "selfie.php.jpg" cannot become a path ending in .php, and the name
        // cannot be guessed from what the user called the file.
        $this->assertStringEndsWith('.jpg', $photo->path);
        $this->assertStringNotContainsString('selfie', $photo->path);
        $this->assertStringNotContainsString('.php', $photo->path);
    }

    public function test_a_non_image_is_refused(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
            'taken_on' => '2026-11-14',
        ])->assertStatus(422)->assertJsonValidationErrors(['photo']);

        $this->assertSame(0, ProgressPhoto::query()->count());
    }

    public function test_a_php_file_renamed_as_an_image_is_refused(): void
    {
        // Deliberately a real file rather than UploadedFile::fake(): the fake
        // reports its mime type from the filename, so it would prove nothing
        // here. A genuine UploadedFile makes getMimeType() sniff the contents,
        // which is the whole reason the rule is `mimetypes:` and not `mimes:`.
        $path = tempnam(sys_get_temp_dir(), 'shell').'.jpg';
        file_put_contents($path, '<?php echo "not an image"; ?>');

        try {
            $this->postJson('/api/v1/progress-photos', [
                'photo' => new UploadedFile($path, 'shell.jpg', null, null, true),
                'taken_on' => '2026-11-14',
            ])->assertStatus(422)->assertJsonValidationErrors(['photo']);

            $this->assertSame(0, ProgressPhoto::query()->count());
        } finally {
            @unlink($path);
        }
    }

    public function test_an_oversized_image_is_refused(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()
                ->image('huge.jpg')
                ->size(ProgressPhotoStorage::MAX_KILOBYTES + 1),
            'taken_on' => '2026-11-14',
        ])->assertStatus(422)->assertJsonValidationErrors(['photo']);
    }

    public function test_the_owner_can_download_their_own_photo(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('front.jpg'),
            'taken_on' => '2026-11-14',
        ])->assertCreated();

        $photo = ProgressPhoto::query()->firstOrFail();

        $response = $this->get(route('api.v1.progress-photos.file', $photo));

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        // A shared cache must never hold somebody's body photo.
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
    }

    public function test_another_user_cannot_download_it(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('front.jpg'),
            'taken_on' => '2026-11-14',
        ])->assertCreated();

        $photo = ProgressPhoto::query()->firstOrFail();

        Sanctum::actingAs(User::factory()->create());

        // Holding the id is not access, and a 404 rather than a 403 so the
        // photo's existence is never confirmed.
        $this->get(route('api.v1.progress-photos.file', $photo))->assertNotFound();
    }

    public function test_a_signed_out_visitor_cannot_download_it(): void
    {
        $photo = ProgressPhoto::factory()->for($this->user)->create();

        $this->app['auth']->forgetGuards();

        $this->getJson(route('api.v1.progress-photos.file', $photo))->assertUnauthorized();
    }

    public function test_a_row_whose_file_has_vanished_is_a_404_not_an_error(): void
    {
        $photo = ProgressPhoto::factory()->for($this->user)->create();

        // The factory writes no file, which is a real state: a half-finished
        // delete, or a restored database without its storage directory.
        $this->get(route('api.v1.progress-photos.file', $photo))->assertNotFound();
    }

    public function test_deleting_the_row_deletes_the_file(): void
    {
        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('front.jpg'),
            'taken_on' => '2026-11-14',
        ])->assertCreated();

        $photo = ProgressPhoto::query()->firstOrFail();
        $path = $photo->path;

        $this->deleteJson("/api/v1/progress-photos/{$photo->getKey()}")->assertNoContent();

        Storage::disk(ProgressPhotoStorage::DISK)->assertMissing($path);
        $this->assertModelMissing($photo);
    }

    public function test_a_photo_cannot_be_pinned_to_somebody_elses_reading(): void
    {
        $theirs = BodyMetric::factory()->for(User::factory()->create())->create();

        $this->postJson('/api/v1/progress-photos', [
            'photo' => UploadedFile::fake()->image('front.jpg'),
            'taken_on' => '2026-11-14',
            'body_metric_id' => $theirs->getKey(),
        ])->assertStatus(422)->assertJsonValidationErrors(['body_metric_id']);
    }

    public function test_the_list_shows_only_your_own_photos(): void
    {
        ProgressPhoto::factory()->for($this->user)->create();
        ProgressPhoto::factory()->for(User::factory()->create())->create();

        $this->getJson('/api/v1/progress-photos')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
