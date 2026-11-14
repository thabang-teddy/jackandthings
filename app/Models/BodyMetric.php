<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A day's body figures: weight in grams, body fat in permille (so 17.5% is
 * 175 and nothing rounds), and a json map of tape measurements in millimetres.
 *
 * One row per day, enforced by a unique index - logging twice replaces the
 * day's figures rather than giving the charts two points to plot.
 *
 * Health data about a person; docs/SECURITY.md "Privacy" covers it.
 */
#[Fillable(['measured_on', 'weight_grams', 'body_fat_permille', 'measurements', 'notes'])]
class BodyMetric extends Model
{
    /** The tape sites a measurements map may carry, all optional, in mm. */
    public const SITES = ['chest', 'waist', 'hips', 'arm', 'thigh', 'calf', 'neck'];

    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'measured_on' => 'date',
            'weight_grams' => 'integer',
            'body_fat_permille' => 'integer',
            'measurements' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ProgressPhoto::class);
    }
}
