<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'focus_minutes', 'break_minutes', 'is_default'])]
class PomodoroPreset extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'focus_minutes' => 'integer',
            'break_minutes' => 'integer',
            'is_default' => 'boolean',
        ];
    }

    /**
     * Keep at most one default preset per user: whenever a preset is saved as
     * the default, the others for that user are cleared. Runs for both the web
     * and API writers, which share the create/update path.
     */
    protected static function booted(): void
    {
        static::saved(function (self $preset): void {
            if (! $preset->is_default) {
                return;
            }

            static::query()
                ->where('user_id', $preset->user_id)
                ->whereKeyNot($preset->getKey())
                ->where('is_default', true)
                ->update(['is_default' => false]);
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
