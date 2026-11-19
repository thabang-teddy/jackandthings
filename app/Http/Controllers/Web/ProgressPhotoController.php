<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProgressPhotoRequest;
use App\Models\ProgressPhoto;
use App\Services\ProgressPhotoStorage;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Progress photos from the web pages.
 *
 * `file` is the only route to a stored image and it authorizes `view` before
 * streaming a byte - holding the id is not access. The files sit on a private
 * disk with no public URL; see App\Services\ProgressPhotoStorage and
 * docs/SECURITY.md "Uploads".
 */
class ProgressPhotoController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly ProgressPhotoStorage $storage) {}

    public function store(ProgressPhotoRequest $request): RedirectResponse
    {
        $this->storage->store(
            $request->user(),
            $request->file('photo'),
            $request->attributesForModel(),
        );

        return back()->with('status', 'Photo saved.');
    }

    /**
     * The authorization below is the whole security model for these files.
     */
    public function file(ProgressPhoto $photo): StreamedResponse
    {
        $this->authorizeOwned('view', $photo);

        abort_unless($this->storage->exists($photo), 404);

        return $this->storage->response($photo);
    }

    /** Deletes the stored image as well as the row. */
    public function destroy(ProgressPhoto $photo): RedirectResponse
    {
        $this->authorizeOwned('delete', $photo);

        $photo->deleteWithFile();

        return back()->with('status', 'Photo deleted.');
    }
}
