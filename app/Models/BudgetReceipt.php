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
 * A receipt image's record. The file lives on a private disk and is reachable
 * only through the authorized download action - the same rules as
 * App\Models\ProgressPhoto.
 *
 * `disk`, `path`, `mime` and `size_bytes` are set by BudgetReceiptStorage from
 * the uploaded file, never from request input, which is why they are outside
 * #[Fillable].
 */
#[Fillable(['transaction_id'])]
class BudgetReceipt extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(BudgetTransaction::class, 'transaction_id');
    }

    /** Deletes the stored file as well as the row. */
    public function deleteWithFile(): void
    {
        Storage::disk($this->disk)->delete($this->path);

        $this->delete();
    }
}
