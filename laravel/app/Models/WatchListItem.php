<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['watch_list_id', 'title', 'note', 'done'])]
class WatchListItem extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'done' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function watchList(): BelongsTo
    {
        return $this->belongsTo(WatchList::class, 'watch_list_id');
    }
}
