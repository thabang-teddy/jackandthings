<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProgressPhotoRequest;
use App\Http\Resources\ProgressPhotoPayload;
use App\Models\ProgressPhoto;
use App\Services\ProgressPhotoStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Progress photos.
 *
 * `file` is the only way to read one of these images. It authorizes `view`
 * first, so possession of an id is not access, and the file itself sits on a
 * private disk with no public URL - see App\Services\ProgressPhotoStorage and
 * docs/SECURITY.md "Uploads".
 */
class ProgressPhotoController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly ProgressPhotoStorage $storage) {}

    public function index(Request $request): JsonResponse
    {
        $photos = $request->user()
            ->progressPhotos()
            ->orderByDesc('taken_on')
            ->get();

        return response()->json([
            'data' => ProgressPhotoPayload::collection($photos, ProgressPhotoPayload::API_FILE_ROUTE),
        ]);
    }

    public function store(ProgressPhotoRequest $request): JsonResponse
    {
        $photo = $this->storage->store(
            $request->user(),
            $request->file('photo'),
            $request->attributesForModel(),
        );

        return response()->json([
            'data' => ProgressPhotoPayload::from($photo, ProgressPhotoPayload::API_FILE_ROUTE),
        ], 201);
    }

    /**
     * Streams the image. The authorization below is the whole security model
     * for these files: there is no other route to them.
     */
    public function file(ProgressPhoto $photo): StreamedResponse
    {
        $this->authorizeOwned('view', $photo);

        abort_unless($this->storage->exists($photo), 404);

        return $this->storage->response($photo);
    }

    /** Deletes the stored image as well as the row. */
    public function destroy(ProgressPhoto $photo): JsonResponse
    {
        $this->authorizeOwned('delete', $photo);

        $photo->deleteWithFile();

        return response()->json(status: 204);
    }
}
