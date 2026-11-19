<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\PomodoroPhase;
use App\Models\PomodoroPreset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A finished interval, posted by whichever client watched it end.
 *
 * The client supplies the timestamps rather than the server stamping `now()`,
 * because a client can be offline when an interval ends and post it later -
 * the Android app does exactly that. The window below is the guard that buys:
 * a session cannot be claimed to have ended in the future or to have run
 * longer than the longest interval a preset can define.
 */
class PomodoroSessionRequest extends FormRequest
{
    /** 120-minute long break is the longest a preset allows; this leaves slack. */
    private const MAX_DURATION_SECONDS = 4 * 60 * 60;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Scoped so one user can never attribute a session to another
            // user's preset - see docs/DATABASE.md "Access rules".
            'pomodoro_preset_id' => [
                'sometimes',
                'nullable',
                'uuid',
                Rule::exists(PomodoroPreset::class, 'id')->where('user_id', $this->user()->getKey()),
            ],
            'preset_name' => ['required', 'string', 'max:60'],
            'tag' => ['sometimes', 'nullable', 'string', 'max:40'],
            'phase' => ['required', Rule::in(PomodoroPhase::values())],

            'started_at' => ['required', 'date', 'before:ended_at'],
            'ended_at' => ['required', 'date', 'before_or_equal:'.now()->addMinutes(5)->toIso8601String()],

            'duration_seconds' => ['required', 'integer', 'min:1', 'max:'.self::MAX_DURATION_SECONDS],
            'completed' => ['sometimes', 'boolean'],
            'source' => ['sometimes', 'nullable', 'string', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'ended_at.before_or_equal' => 'A session cannot end in the future.',
        ];
    }
}
