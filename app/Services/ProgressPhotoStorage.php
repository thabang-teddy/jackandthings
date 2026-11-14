<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ProgressPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The only place in this application that writes an uploaded file.
 *
 * Progress photos are pictures of somebody's body, so the rules here are
 * deliberately strict and stated rather than assumed:
 *
 * - They go on the *private* disk (storage/app/private), never `public`. There
 *   is no public URL for one, and `php artisan storage:link` has nothing to do
 *   with them.
 * - The stored name is random and the extension is derived from the validated
 *   mime type, never from the client's filename - an uploaded
 *   "selfie.php.jpg" cannot become a path ending in .php, and a filename
 *   cannot traverse out of its directory.
 * - Reading one goes back through the controller, which authorizes `view`
 *   first. Possession of an id is not access.
 * - Deleting the row deletes the file. See ProgressPhoto::deleteWithFile().
 *
 * docs/SECURITY.md "Uploads" is the companion to this class.
 */
class ProgressPhotoStorage
{
    /** The private disk. Not `public` - see the class comment. */
    public const DISK = 'local';

    /** Largest accepted upload, in kilobytes (8 MB). */
    public const MAX_KILOBYTES = 8192;

    /**
     * The only accepted types, as mime => extension. A short allow-list
     * rather than a block-list, and the extension comes from here rather than
     * from whatever the client called the file.
     */
    public const ACCEPTED = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
    ];

    /**
     * Validation rules the FormRequests share, so the web form and the API
     * cannot drift apart on what they accept.
     *
     * @return array<int, mixed>
     */
    public static function fileRules(): array
    {
        return [
            'required',
            'file',
            'image',
            'mimetypes:'.implode(',', array_keys(self::ACCEPTED)),
            'max:'.self::MAX_KILOBYTES,
        ];
    }

    /**
     * Stores the image and records it. The row's disk, path, mime and size all
     * come from the file itself, which is why they are outside the model's
     * #[Fillable] - a request cannot name its own storage path.
     *
     * @param  array<string, mixed>  $attributes  Validated taken_on, caption, body_metric_id.
     */
    public function store(User $user, UploadedFile $file, array $attributes): ProgressPhoto
    {
        $mime = $file->getMimeType() ?? 'application/octet-stream';
        $extension = self::ACCEPTED[$mime] ?? null;

        // Belt and braces: validation already rejected anything not on the
        // allow-list, so reaching here means the two have drifted apart.
        if ($extension === null) {
            throw new \RuntimeException("Refusing to store an unaccepted image type: {$mime}");
        }

        $path = $file->storeAs(
            $this->directoryFor($user),
            bin2hex(random_bytes(16)).'.'.$extension,
            ['disk' => self::DISK]
        );

        if ($path === false) {
            throw new \RuntimeException('Could not write the uploaded photo to storage.');
        }

        $photo = new ProgressPhoto($attributes);
        $photo->disk = self::DISK;
        $photo->path = $path;
        $photo->mime = $mime;
        $photo->size_bytes = $file->getSize() ?: 0;
        $photo->taken_on = $attributes['taken_on'] ?? Carbon::now()->toDateString();

        $user->progressPhotos()->save($photo);

        return $photo;
    }

    /**
     * Streams the image back. Callers must authorize `view` on the photo
     * before calling this - the model is not self-guarding.
     *
     * Inline rather than an attachment so a thumbnail can render, with
     * nosniff so a browser cannot be talked into treating it as anything but
     * the image type we stored.
     */
    public function response(ProgressPhoto $photo): StreamedResponse
    {
        return Storage::disk($photo->disk)->response($photo->path, null, [
            'Content-Type' => $photo->mime,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            // Private: a shared cache must never hold somebody's body photo.
            'Cache-Control' => 'private, max-age=300, no-transform',
        ]);
    }

    /** Whether the file behind a row is actually still there. */
    public function exists(ProgressPhoto $photo): bool
    {
        return Storage::disk($photo->disk)->exists($photo->path);
    }

    /**
     * One directory per user. Not security on its own - the authorization is
     * the controller's - but it keeps one user's files from being listed
     * alongside another's, and makes a per-user purge a single operation.
     */
    private function directoryFor(User $user): string
    {
        return 'progress-photos/'.$user->getKey();
    }
}
