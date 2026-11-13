<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PomodoroAmbience;
use App\Enums\PomodoroPhase;
use App\Enums\PomodoroSound;
use App\Enums\PomodoroTicking;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'focus_minutes',
    'break_minutes',
    'long_break_minutes',
    'cycles_before_long_break',
    'auto_start_breaks',
    'auto_start_focus',
    'tag',
    'alarm_sound',
    'ticking_sound',
    'ambience',
    'strict_mode',
    'blocked_sites',
    'is_default',
])]
class PomodoroPreset extends Model
{
    use HasFactory, HasUuids;

    /**
     * Mirrors the column defaults so a preset created from a payload that
     * omits the optional fields is complete *in memory* too, not only once
     * it has been read back. Without this, a client posting the old
     * four-field payload got a model whose `alarm_sound` was null, and
     * PomodoroPresetPayload reading `->value` off it blew up.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'break_minutes' => 5,
        'long_break_minutes' => 15,
        'cycles_before_long_break' => 4,
        'auto_start_breaks' => true,
        'auto_start_focus' => false,
        'alarm_sound' => 'chime',
        'ticking_sound' => 'none',
        'ambience' => 'none',
        'strict_mode' => false,
        'is_default' => false,
    ];

    protected function casts(): array
    {
        return [
            'focus_minutes' => 'integer',
            'break_minutes' => 'integer',
            'long_break_minutes' => 'integer',
            'cycles_before_long_break' => 'integer',
            'auto_start_breaks' => 'boolean',
            'auto_start_focus' => 'boolean',
            'alarm_sound' => PomodoroSound::class,
            'ticking_sound' => PomodoroTicking::class,
            'ambience' => PomodoroAmbience::class,
            'strict_mode' => 'boolean',
            'blocked_sites' => 'array',
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

    /**
     * How long a given phase runs, in minutes. The one place the three
     * duration columns are mapped onto PomodoroPhase, so no client-facing
     * payload has to guess which column a phase reads from.
     */
    public function minutesFor(PomodoroPhase $phase): int
    {
        return match ($phase) {
            PomodoroPhase::Focus => $this->focus_minutes,
            PomodoroPhase::ShortBreak => $this->break_minutes,
            PomodoroPhase::LongBreak => $this->long_break_minutes,
        };
    }

    /**
     * The blocklist as a plain list of host patterns. Null (never set) and an
     * empty array mean the same thing to every caller, so both come back as
     * an empty list rather than making each client handle null.
     *
     * @return array<int, string>
     */
    public function blockedSites(): array
    {
        return array_values(array_filter(
            $this->blocked_sites ?? [],
            static fn (mixed $pattern): bool => is_string($pattern) && $pattern !== '',
        ));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(PomodoroSession::class);
    }
}
