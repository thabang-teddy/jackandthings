<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A progress photo's record. The image itself lives on a private disk and is
 * reachable only through the authorized download action - there is no public
 * URL for one of these and `php artisan storage:link` has nothing to do with
 * it. See App\Services\ProgressPhotoStorage and docs/SECURITY.md "Uploads".
 *
 * `disk`, `path`, `mime` and `size_bytes` are all set by the storage service
 * from the uploaded file, never from request input, which is why they are
 * outside #[Fillable].
 */
#[Fillable(['body_metric_id', 'taken_on', 'caption'])]
class ProgressPhoto extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'taken_on' => 'date',
            'size_bytes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bodyMetric(): BelongsTo
    {
        return $this->belongsTo(BodyMetric::class);
    }

    /**
     * Deletes the stored file as well as the row. Kept on the model so a
     * delete can never leave the image behind, whichever surface asked.
     */
    public function deleteWithFile(): void
    {
        Storage::disk($this->disk)->delete($this->path);

        $this->delete();
    }
}
