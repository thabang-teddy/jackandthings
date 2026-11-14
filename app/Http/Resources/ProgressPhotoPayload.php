<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProgressPhoto;

/**
 * A progress photo's record.
 *
 * Deliberately *not* on the wire: `disk` and `path`. A client has no use for
 * where the file sits on the server, and publishing it would invite somebody
 * to try reaching it directly. The image is fetched from `url`, which is an
 * authorized route - the policy is checked before a byte is streamed.
 *
 * There are two such routes, because the two guards are different: the web app
 * holds a session cookie and the Android client a bearer token. The caller
 * names the one its own surface can actually authenticate against, which is
 * why the route name is a parameter rather than hard-coded here.
 */
final class ProgressPhotoPayload
{
    /** The session-guarded route, for the Inertia pages. */
    public const WEB_FILE_ROUTE = 'progress-photos.file';

    /** The token-guarded route, for the Android client. */
    public const API_FILE_ROUTE = 'api.v1.progress-photos.file';

    /**
     * @return array<string, mixed>
     */
    public static function from(ProgressPhoto $photo, string $fileRoute = self::WEB_FILE_ROUTE): array
    {
        return [
            'id' => $photo->id,
            'body_metric_id' => $photo->body_metric_id,
            'taken_on' => $photo->taken_on?->toDateString(),
            'caption' => $photo->caption,
            'mime' => $photo->mime,
            'size_bytes' => $photo->size_bytes,
            'url' => route($fileRoute, $photo),
        ];
    }

    /**
     * @param  iterable<ProgressPhoto>  $photos
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $photos, string $fileRoute = self::WEB_FILE_ROUTE): array
    {
        $payload = [];
        foreach ($photos as $photo) {
            $payload[] = self::from($photo, $fileRoute);
        }

        return $payload;
    }
}
